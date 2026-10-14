// @vitest-environment node
import {
  createIdTokenCache, exchangeRefreshToken, FirebaseAuthError, signInWithPassword, type FetchLike,
} from './firebaseAuth.js';

interface Seen { url: string; init: RequestInit }

function fakeFetch(status: number, body: unknown) {
  const seen: Seen[] = [];
  const fetchFn: FetchLike = async (url, init = {}) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetchFn, seen };
}

const REFRESHED = { id_token: 'id-2', refresh_token: 'rt-1', expires_in: '3600', user_id: 'u1' };

describe('signInWithPassword', () => {
  it('posts the lower-cased email and returns the tokens', async () => {
    const { fetchFn, seen } = fakeFetch(200, {
      localId: 'u1', idToken: 'id-1', refreshToken: 'rt-1', expiresIn: '3600',
    });
    const result = await signInWithPassword('api-key', '  Sam@Shopit.TEST ', 'pw', fetchFn);
    expect(result).toEqual({ uid: 'u1', idToken: 'id-1', refreshToken: 'rt-1' });
    expect(seen[0].url).toBe(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=api-key'
    );
    expect(JSON.parse(seen[0].init.body as string)).toEqual({
      email: 'sam@shopit.test', password: 'pw', returnSecureToken: true,
    });
  });

  it('turns a bad password into the message the app shows', async () => {
    const { fetchFn } = fakeFetch(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
    await expect(signInWithPassword('k', 'a@b.c', 'wrong', fetchFn)).rejects.toMatchObject({
      code: 'INVALID_LOGIN_CREDENTIALS', message: 'Invalid email or password.',
    });
  });

  it('reads the code in front of a long throttling message', async () => {
    const { fetchFn } = fakeFetch(400, {
      error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled' },
    });
    await expect(signInWithPassword('k', 'a@b.c', 'x', fetchFn)).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS_TRY_LATER',
      message: 'Too many failed attempts. Try again later or reset your password.',
    });
  });

  it('reports an unreachable service as a sign-in error, not a crash', async () => {
    const fetchFn: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(signInWithPassword('k', 'a@b.c', 'x', fetchFn)).rejects.toBeInstanceOf(FirebaseAuthError);
  });
});

describe('exchangeRefreshToken', () => {
  it('posts a form and returns the ID token with its expiry', async () => {
    const { fetchFn, seen } = fakeFetch(200, REFRESHED);
    const result = await exchangeRefreshToken('api-key', 'rt-1', fetchFn, 1_000);
    expect(result).toEqual({ uid: 'u1', idToken: 'id-2', refreshToken: 'rt-1', expiresAt: 3_601_000 });
    expect(seen[0].url).toBe('https://securetoken.googleapis.com/v1/token?key=api-key');
    expect(seen[0].init.body).toBe('grant_type=refresh_token&refresh_token=rt-1');
  });

  it('fails on a revoked token with the sign-in-again message', async () => {
    const { fetchFn } = fakeFetch(400, { error: { message: 'TOKEN_EXPIRED' } });
    await expect(exchangeRefreshToken('k', 'rt-1', fetchFn)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED', message: 'Your Limi sign-in has expired. Sign in again.',
    });
  });
});

describe('createIdTokenCache', () => {
  it('reuses a token until five minutes before it expires', async () => {
    const { fetchFn, seen } = fakeFetch(200, REFRESHED);
    const idTokenFor = createIdTokenCache('k', fetchFn);
    await idTokenFor('rt-1', 0);
    await idTokenFor('rt-1', 54 * 60_000);
    expect(seen).toHaveLength(1);
    await idTokenFor('rt-1', 56 * 60_000);
    expect(seen).toHaveLength(2);
  });

  it('keeps tokens apart per refresh token', async () => {
    const { fetchFn, seen } = fakeFetch(200, REFRESHED);
    const idTokenFor = createIdTokenCache('k', fetchFn);
    await idTokenFor('rt-1', 0);
    await idTokenFor('rt-2', 0);
    expect(seen).toHaveLength(2);
  });
});
