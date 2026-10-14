// Test support only: an in-memory stand-in for the three Google APIs the
// server calls — Firebase Auth sign-in, the securetoken exchange and Firestore
// REST. Nothing in the tests touches live Firebase.
import { decodeFields, decodeValue, encodeFields, type FsValue } from './firestore.js';
import type { FetchLike } from './firebaseAuth.js';

export type FakeOp = 'get' | 'list' | 'create' | 'update';

export interface FakeCall {
  op: FakeOp;
  /** Document path for get/create/update; collection path for list. */
  path: string;
  /** The update mask, for update. */
  mask?: string[];
}

export type ReadDoc = (path: string) => Record<string, unknown> | undefined;

export interface FakeGoogleOptions {
  projectId?: string;
  docs?: Record<string, Record<string, unknown>>;
  accounts?: { email: string; password: string; uid: string }[];
  /** Answer 403 when this returns true, as firestore.rules would. */
  deny?: (call: FakeCall, uid: string, read: ReadDoc) => boolean;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const denied = () =>
  json(403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } });

function parseBody(body: RequestInit['body']): Record<string, unknown> {
  if (typeof body !== 'string') return {};
  return body.startsWith('{') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
}

export function fakeGoogle(options: FakeGoogleOptions = {}) {
  const projectId = options.projectId ?? 'limi-test';
  const docs = new Map<string, Record<string, unknown>>(
    Object.entries(options.docs ?? {}).map(([path, data]) => [path, structuredClone(data)])
  );
  const revoked = new Set<string>();
  /** Every Firestore call that reached the fake, in order, refused ones included. */
  const calls: FakeCall[] = [];
  const read: ReadDoc = (path) => docs.get(path);
  const prefix = `/v1/projects/${projectId}/databases/(default)/documents`;

  function firestore(url: URL, method: string, init: RequestInit): Response {
    const auth = new Headers(init.headers).get('Authorization') ?? '';
    const uid = auth.startsWith('Bearer id-') ? auth.slice('Bearer id-'.length) : '';
    if (!uid || revoked.has(uid)) {
      return json(401, { error: { status: 'UNAUTHENTICATED', message: 'Invalid token' } });
    }
    const rest = decodeURIComponent(url.pathname.slice(prefix.length));
    const body = parseBody(init.body);

    let call: FakeCall;
    if (rest === ':commit') {
      const write = (body.writes as {
        update: { name: string; fields?: Record<string, FsValue> };
        updateMask: { fieldPaths: string[] };
        updateTransforms?: { fieldPath: string; appendMissingElements: { values: FsValue[] } }[];
      }[])[0];
      const path = write.update.name.slice(write.update.name.indexOf('/documents/') + '/documents/'.length);
      call = { op: 'update', path, mask: write.updateMask.fieldPaths };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      const current = docs.get(path);
      if (!current) return json(404, { error: { status: 'NOT_FOUND', message: `No document to update: ${path}` } });
      const fields = decodeFields(write.update.fields ?? {});
      for (const key of write.updateMask.fieldPaths) {
        if (key in fields) current[key] = fields[key];
        else delete current[key];
      }
      for (const t of write.updateTransforms ?? []) {
        const list = Array.isArray(current[t.fieldPath]) ? (current[t.fieldPath] as unknown[]) : [];
        for (const v of t.appendMissingElements.values.map(decodeValue)) {
          if (!list.some((x) => JSON.stringify(x) === JSON.stringify(v))) list.push(v);
        }
        current[t.fieldPath] = list;
      }
      return json(200, { writeResults: [{}] });
    }

    const path = rest.replace(/^\//, '');
    const depth = path.split('/').length;
    if (method === 'GET' && depth % 2 === 0) {
      call = { op: 'get', path };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      const data = docs.get(path);
      if (!data) return json(404, { error: { status: 'NOT_FOUND', message: `${path} not found` } });
      return json(200, { name: `projects/${projectId}/databases/(default)/documents/${path}`, fields: encodeFields(data) });
    }
    if (method === 'GET') {
      call = { op: 'list', path };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      const documents = [...docs.entries()]
        .filter(([p]) => p.startsWith(`${path}/`) && p.split('/').length === depth + 1)
        .map(([p, data]) => ({
          name: `projects/${projectId}/databases/(default)/documents/${p}`,
          fields: encodeFields(data),
        }));
      return json(200, documents.length > 0 ? { documents } : {});
    }
    if (method === 'POST') {
      const docPath = `${path}/${url.searchParams.get('documentId')}`;
      call = { op: 'create', path: docPath };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      if (docs.has(docPath)) return json(409, { error: { status: 'ALREADY_EXISTS', message: 'exists' } });
      docs.set(docPath, decodeFields((body.fields ?? {}) as Record<string, FsValue>));
      return json(200, { name: docPath });
    }
    return json(400, { error: { status: 'INVALID_ARGUMENT', message: `${method} ${path}` } });
  }

  const fetchFn: FetchLike = async (input, init = {}) => {
    const url = new URL(input);
    const method = (init.method ?? 'GET').toUpperCase();
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      const { email, password } = parseBody(init.body) as { email: string; password: string };
      const account = options.accounts?.find((a) => a.email === email && a.password === password);
      if (!account) return json(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
      return json(200, {
        localId: account.uid, idToken: `id-${account.uid}`, refreshToken: `rt-${account.uid}`, expiresIn: '3600',
      });
    }
    if (url.hostname === 'securetoken.googleapis.com') {
      const token = String(parseBody(init.body).refresh_token ?? '');
      const uid = token.startsWith('rt-') ? token.slice(3) : '';
      if (!uid || revoked.has(uid)) return json(400, { error: { message: 'TOKEN_EXPIRED' } });
      return json(200, { id_token: `id-${uid}`, refresh_token: token, expires_in: '3600', user_id: uid });
    }
    if (url.hostname === 'firestore.googleapis.com' && url.pathname.startsWith(prefix)) {
      return firestore(url, method, init);
    }
    throw new TypeError(`fakeGoogle: unexpected request ${method} ${input}`);
  };

  return {
    projectId,
    fetch: fetchFn,
    calls,
    doc: read,
    /** Every document path under a prefix. */
    paths: (under: string) => [...docs.keys()].filter((p) => p.startsWith(under)),
    /** What changing a password does: every refresh token for that account stops working. */
    revoke: (uid: string) => revoked.add(uid),
  };
}

const REVIEW_FIELDS = ['clientReview', 'reviewNote'];

/** firestore.rules, reduced to what the server's calls exercise. */
export function limiRules(call: FakeCall, uid: string, read: ReadDoc): boolean {
  const seg = call.path.split('/');
  const profile = read(`users/${uid}`) as { role?: string; assignedClientIds?: string[] } | undefined;
  if (seg[0] === 'users') {
    if (call.op === 'get' && seg[1] === uid) return false;
    return profile?.role !== 'admin';
  }
  if (!profile || seg[0] !== 'clients') return true;
  const team = profile.role === 'admin' || profile.role === 'social-media-manager';
  if (team) return false;
  // Rules are not filters: listing every client is refused to a client.
  if (seg.length === 1) return true;
  if (!(profile.assignedClientIds ?? []).includes(seg[1])) return true;
  if (call.op === 'get' || call.op === 'list') return false;
  if (call.op === 'create') {
    const comment = seg.length === 6 && (seg[2] === 'content' || seg[2] === 'ideas') && seg[4] === 'comments';
    const idea = seg.length === 4 && seg[2] === 'ideas';
    return !(comment || idea);
  }
  // update: a client may record a review decision and nothing else.
  return !(seg.length === 4 && seg[2] === 'content' && (call.mask ?? []).every((f) => REVIEW_FIELDS.includes(f)));
}
