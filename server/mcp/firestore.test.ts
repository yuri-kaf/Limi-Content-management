// @vitest-environment node
import {
  createFirestore, decodeDocument, decodeValue, encodeFields, encodeValue, FirestoreError, updateMaskFor,
} from './firestore.js';
import type { FetchLike } from './firebaseAuth.js';

const ROOT = 'https://firestore.googleapis.com/v1/projects/limi-test/databases/(default)/documents';

interface Seen { url: string; init: RequestInit }

function respond(...answers: { status?: number; body: unknown }[]) {
  const seen: Seen[] = [];
  const fetchFn: FetchLike = async (url, init = {}) => {
    seen.push({ url, init });
    const answer = answers[Math.min(seen.length - 1, answers.length - 1)];
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  };
  return { fs: createFirestore({ projectId: 'limi-test', idToken: 'id-1', fetch: fetchFn }), seen };
}

describe('value encoding', () => {
  it('encodes each type Limi stores', () => {
    expect(encodeValue('Momo')).toEqual({ stringValue: 'Momo' });
    expect(encodeValue(1791982686000)).toEqual({ integerValue: '1791982686000' });
    expect(encodeValue(2.5)).toEqual({ doubleValue: 2.5 });
    expect(encodeValue(true)).toEqual({ booleanValue: true });
    expect(encodeValue(null)).toEqual({ nullValue: null });
    expect(encodeValue(['instagram', 'tiktok'])).toEqual({
      arrayValue: { values: [{ stringValue: 'instagram' }, { stringValue: 'tiktok' }] },
    });
    expect(encodeValue({ link: 'a', at: 1 })).toEqual({
      mapValue: { fields: { link: { stringValue: 'a' }, at: { integerValue: '1' } } },
    });
  });

  it('drops undefined fields', () => {
    expect(encodeFields({ a: 'x', b: undefined })).toEqual({ a: { stringValue: 'x' } });
  });

  it('round-trips nested data', () => {
    const data = {
      title: 'Momo reel',
      createdAt: 100,
      platforms: ['instagram'],
      versions: [{ link: 'https://old', replacedAt: 5, mediaType: 'video' }],
      empty: [],
      nothing: null,
    };
    expect(decodeValue(encodeValue(data))).toEqual(data);
  });

  it('reads an empty array as []', () => {
    expect(decodeValue({ arrayValue: {} })).toEqual([]);
  });

  it('takes the id from the document name', () => {
    expect(
      decodeDocument({
        name: 'projects/p/databases/(default)/documents/clients/shopit',
        fields: { name: { stringValue: 'Shopit' } },
      })
    ).toEqual({ name: 'Shopit', id: 'shopit' });
  });
});

describe('updateMaskFor', () => {
  it('is exactly the fields that are set', () => {
    expect(updateMaskFor({ status: 'review', title: undefined, reviewNote: '' })).toEqual([
      'status',
      'reviewNote',
    ]);
  });
});

describe('createFirestore', () => {
  it('gets a document with the ID token', async () => {
    const { fs, seen } = respond({ body: { name: `x/clients/shopit`, fields: { name: { stringValue: 'Shopit' } } } });
    expect(await fs.get('clients/shopit')).toEqual({ name: 'Shopit', id: 'shopit' });
    expect(seen[0].url).toBe(`${ROOT}/clients/shopit`);
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe('Bearer id-1');
  });

  it('reads a missing document as null', async () => {
    const { fs } = respond({ status: 404, body: { error: { status: 'NOT_FOUND', message: 'nope' } } });
    expect(await fs.get('clients/gone')).toBeNull();
  });

  it('raises a refusal with its status', async () => {
    const { fs } = respond({
      status: 403,
      body: { error: { status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } },
    });
    const err = await fs.get('clients/everest').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirestoreError);
    expect(err).toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('follows list pages', async () => {
    const { fs, seen } = respond(
      { body: { documents: [{ name: 'x/a', fields: {} }], nextPageToken: 'next' } },
      { body: { documents: [{ name: 'x/b', fields: {} }] } }
    );
    expect((await fs.list('clients/shopit/content')).map((d) => d.id)).toEqual(['a', 'b']);
    expect(seen[0].url).toBe(`${ROOT}/clients/shopit/content?pageSize=300`);
    expect(seen[1].url).toBe(`${ROOT}/clients/shopit/content?pageSize=300&pageToken=next`);
  });

  it('lists an empty collection as []', async () => {
    const { fs } = respond({ body: {} });
    expect(await fs.list('clients/shopit/ideas')).toEqual([]);
  });

  it('creates a document under the given id', async () => {
    const { fs, seen } = respond({ body: {} });
    await fs.create('clients/shopit/ideas', 'i9', { title: 'Lights', businessId: undefined });
    expect(seen[0].url).toBe(`${ROOT}/clients/shopit/ideas?documentId=i9`);
    expect(seen[0].init.method).toBe('POST');
    expect(JSON.parse(seen[0].init.body as string)).toEqual({ fields: { title: { stringValue: 'Lights' } } });
  });

  it('updates only the changed fields, and appends atomically', async () => {
    const { fs, seen } = respond({ body: {} });
    await fs.update(
      'clients/shopit/content/momo',
      { driveLink: 'https://new', title: undefined },
      { versions: [{ link: 'https://old' }] }
    );
    expect(seen[0].url).toBe(`${ROOT}:commit`);
    expect(JSON.parse(seen[0].init.body as string)).toEqual({
      writes: [
        {
          update: {
            name: 'projects/limi-test/databases/(default)/documents/clients/shopit/content/momo',
            fields: { driveLink: { stringValue: 'https://new' } },
          },
          updateMask: { fieldPaths: ['driveLink'] },
          currentDocument: { exists: true },
          updateTransforms: [
            {
              fieldPath: 'versions',
              appendMissingElements: {
                values: [{ mapValue: { fields: { link: { stringValue: 'https://old' } } } }],
              },
            },
          ],
        },
      ],
    });
  });

  it('reports an unreachable database as a FirestoreError', async () => {
    const fs = createFirestore({
      projectId: 'p',
      idToken: 't',
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(fs.list('clients')).rejects.toMatchObject({ status: 0, code: 'UNAVAILABLE' });
  });
});
