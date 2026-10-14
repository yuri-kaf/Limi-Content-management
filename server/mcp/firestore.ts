import type { FetchLike } from './firebaseAuth.js';

// A small Firestore REST client. Every call carries the signed-in person's own
// ID token, so firestore.rules decide what it may read and write, exactly as
// they do for the app.

export type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

export interface FsDocument {
  /** projects/{p}/databases/(default)/documents/{path} */
  name: string;
  fields?: Record<string, FsValue>;
}

export function encodeValue(value: unknown): FsValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    // Timestamps and counts are integers; the JS SDK stores them the same way.
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.filter((v) => v !== undefined).map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }
  throw new Error(`Cannot store a ${typeof value} in Firestore.`);
}

/** Undefined fields are dropped, as Firestore rejects them outright. */
export function encodeFields(data: Record<string, unknown>): Record<string, FsValue> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, encodeValue(v)])
  );
}

export function decodeValue(value: FsValue): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return Date.parse(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
  // Types Limi never writes (references, geo points, bytes).
  return null;
}

export function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

/** The document's fields, plus `id` from its name — as the app reads `{ ...data(), id }`. */
export function decodeDocument(doc: FsDocument): Record<string, unknown> & { id: string } {
  return { ...decodeFields(doc.fields ?? {}), id: doc.name.split('/').pop() ?? '' };
}

/** The fields an update writes: exactly those it sets, so nothing else is touched. */
export function updateMaskFor(data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((k) => data[k] !== undefined);
}

export class FirestoreError extends Error {
  constructor(
    /** HTTP status: 403 when the rules refuse, 404 when the document is missing. */
    readonly status: number,
    /** Google's status name, e.g. PERMISSION_DENIED. */
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'FirestoreError';
  }
}

export interface FirestoreClient {
  /** null when the document does not exist. */
  get<T extends object>(path: string): Promise<(T & { id: string }) | null>;
  /** Every document in a collection, in no particular order. */
  list<T extends object>(collectionPath: string): Promise<(T & { id: string })[]>;
  /** Fails if a document with that id already exists. */
  create(collectionPath: string, id: string, data: Record<string, unknown>): Promise<void>;
  /**
   * Writes only the given fields of an existing document, and optionally
   * appends to array fields atomically (Firestore's arrayUnion).
   */
  update(path: string, data: Record<string, unknown>, append?: Record<string, unknown[]>): Promise<void>;
}

const HOST = 'https://firestore.googleapis.com/v1';

export function createFirestore({
  projectId,
  idToken,
  fetch: fetchFn = fetch,
}: {
  projectId: string;
  idToken: string;
  fetch?: FetchLike;
}): FirestoreClient {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const docUrl = (path: string) => `${HOST}/${root}/${path}`;

  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(url, {
        ...init,
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      });
    } catch {
      throw new FirestoreError(0, 'UNAVAILABLE', 'Could not reach the Limi database.');
    }
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = (body as { error?: { status?: string; message?: string } }).error ?? {};
      throw new FirestoreError(res.status, error.status ?? 'UNKNOWN', error.message ?? `Firestore answered ${res.status}.`);
    }
    return body as T;
  }

  return {
    async get<T extends object>(path: string) {
      try {
        return decodeDocument(await call<FsDocument>(docUrl(path))) as T & { id: string };
      } catch (err) {
        if (err instanceof FirestoreError && err.status === 404) return null;
        throw err;
      }
    },

    async list<T extends object>(collectionPath: string) {
      const out: (T & { id: string })[] = [];
      let pageToken = '';
      do {
        const query = new URLSearchParams({ pageSize: '300' });
        if (pageToken) query.set('pageToken', pageToken);
        const page = await call<{ documents?: FsDocument[]; nextPageToken?: string }>(
          `${docUrl(collectionPath)}?${query}`
        );
        out.push(...(page.documents ?? []).map((d) => decodeDocument(d) as T & { id: string }));
        pageToken = page.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },

    async create(collectionPath, id, data) {
      await call(`${docUrl(collectionPath)}?documentId=${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify({ fields: encodeFields(data) }),
      });
    },

    async update(path, data, append = {}) {
      const updateTransforms = Object.entries(append).map(([fieldPath, values]) => ({
        fieldPath,
        appendMissingElements: { values: values.map(encodeValue) },
      }));
      await call(`${HOST}/${root}:commit`, {
        method: 'POST',
        body: JSON.stringify({
          writes: [
            {
              update: { name: `${root}/${path}`, fields: encodeFields(data) },
              updateMask: { fieldPaths: updateMaskFor(data) },
              currentDocument: { exists: true },
              ...(updateTransforms.length > 0 ? { updateTransforms } : {}),
            },
          ],
        }),
      });
    },
  };
}
