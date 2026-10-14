// @vitest-environment node
import { seal, unseal } from './seal.js';

const KEY = new Uint8Array(32).fill(7);
const OTHER_KEY = new Uint8Array(32).fill(8);
const T0 = Date.UTC(2026, 9, 14, 4, 15);

// Flips one character in the middle of the ciphertext segment. The last
// character is avoided: it can carry only padding bits.
function tamper(token: string): string {
  const parts = token.split('.');
  const c = parts[3];
  const i = Math.floor(c.length / 2);
  parts[3] = c.slice(0, i) + (c[i] === 'A' ? 'B' : 'A') + c.slice(i + 1);
  return parts.join('.');
}

describe('seal and unseal', () => {
  it('round-trips the payload', async () => {
    const token = await seal(KEY, 'access', { uid: 'u1', rt: 'refresh-1' }, { ttlSeconds: 60 });
    const claims = await unseal<{ uid: string; rt: string }>(KEY, 'access', token);
    expect(claims).toMatchObject({ uid: 'u1', rt: 'refresh-1' });
  });

  it('cannot be read without the key', async () => {
    const token = await seal(KEY, 'access', { rt: 'refresh-1' });
    expect(token).not.toContain('refresh-1');
    expect(Buffer.from(token.split('.')[3], 'base64url').toString()).not.toContain('refresh-1');
  });

  it('refuses an expired blob', async () => {
    const token = await seal(KEY, 'code', { uid: 'u1' }, { ttlSeconds: 300, now: T0 });
    expect(await unseal(KEY, 'code', token, { now: T0 + 299_000 })).not.toBeNull();
    expect(await unseal(KEY, 'code', token, { now: T0 + 301_000 })).toBeNull();
  });

  it('refuses a tampered blob', async () => {
    const token = await seal(KEY, 'access', { uid: 'u1' });
    expect(await unseal(KEY, 'access', tamper(token))).toBeNull();
  });

  it('refuses a blob sealed under another key', async () => {
    const token = await seal(OTHER_KEY, 'access', { uid: 'u1' });
    expect(await unseal(KEY, 'access', token)).toBeNull();
  });

  it('refuses a blob of another kind', async () => {
    const code = await seal(KEY, 'code', { uid: 'u1' });
    expect(await unseal(KEY, 'access', code)).toBeNull();
  });

  it('checks the audience when one is asked for', async () => {
    const token = await seal(KEY, 'access', { uid: 'u1' }, { audience: 'https://a.example/mcp' });
    expect(await unseal(KEY, 'access', token, { audience: 'https://a.example/mcp' })).not.toBeNull();
    expect(await unseal(KEY, 'access', token, { audience: 'https://b.example/mcp' })).toBeNull();
  });

  it('treats garbage and absence as invalid', async () => {
    expect(await unseal(KEY, 'access', 'not-a-token')).toBeNull();
    expect(await unseal(KEY, 'access', '')).toBeNull();
    expect(await unseal(KEY, 'access', undefined)).toBeNull();
  });
});
