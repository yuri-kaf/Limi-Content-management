// @vitest-environment node
import { keyFromSecret, notConfigured, readEnv } from './env.js';

const SECRET = Buffer.alloc(32, 7).toString('base64');

describe('readEnv', () => {
  it('reads the key and the Firebase settings', () => {
    const result = readEnv({
      MCP_TOKEN_SECRET: SECRET,
      VITE_FIREBASE_API_KEY: 'api-key',
      VITE_FIREBASE_PROJECT_ID: 'limi-test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.key).toHaveLength(32);
    expect(result.env.apiKey).toBe('api-key');
    expect(result.env.projectId).toBe('limi-test');
  });

  it('reports a missing secret', () => {
    const result = readEnv({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' });
    expect(result).toEqual({
      ok: false,
      message: 'The Limi connector is not switched on yet: MCP_TOKEN_SECRET is not set.',
    });
  });

  it('reports missing Firebase settings', () => {
    expect(readEnv({ MCP_TOKEN_SECRET: SECRET }).ok).toBe(false);
  });

  it('refuses a secret that is not 32 bytes', () => {
    const result = readEnv({
      MCP_TOKEN_SECRET: Buffer.alloc(16).toString('base64'),
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_PROJECT_ID: 'p',
    });
    expect(result).toEqual({ ok: false, message: 'MCP_TOKEN_SECRET must be 32 random bytes in base64.' });
  });
});

describe('keyFromSecret', () => {
  it('decodes base64 to 32 bytes', () => {
    expect(Array.from(keyFromSecret(SECRET).slice(0, 3))).toEqual([7, 7, 7]);
  });
});

describe('notConfigured', () => {
  it('is a plain 503', async () => {
    const res = notConfigured('Not yet.');
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Not yet.');
  });
});

describe('time zone', () => {
  it('is Kathmandu once the module has loaded', () => {
    expect(process.env.TZ).toBe('Asia/Kathmandu');
    // 00:00 in Kathmandu is 18:15 the day before in UTC.
    expect(new Date(2026, 9, 14).toISOString()).toBe('2026-10-13T18:15:00.000Z');
  });
});
