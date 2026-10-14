// Firebase Auth over plain REST. No firebase-admin, and no service account:
// the server only ever holds what the signed-in person's own sign-in returns.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class FirebaseAuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

/**
 * Google could not answer: the network failed, it returned a 5xx, or it is
 * rate limiting. Unlike FirebaseAuthError this says nothing about the sign-in
 * itself, so callers answer "try again" and never make the person sign in again.
 */
export class FirebaseUnavailableError extends Error {
  constructor(message = 'The Limi sign-in service is not answering. Try again in a moment.') {
    super(message);
    this.name = 'FirebaseUnavailableError';
  }
}

/** 5xx and 429 are Google's trouble, not the person's: try again later. */
function isTransient(status: number): boolean {
  return status >= 500 || status === 429;
}

const BAD_LOGIN = 'Invalid email or password.';

// The same wording the app's sign-in screen uses (signInErrorMessage).
const SIGN_IN_MESSAGES: Record<string, string> = {
  INVALID_LOGIN_CREDENTIALS: BAD_LOGIN,
  INVALID_PASSWORD: BAD_LOGIN,
  EMAIL_NOT_FOUND: BAD_LOGIN,
  INVALID_EMAIL: 'That email address is not valid.',
  MISSING_PASSWORD: 'Enter your password.',
  USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many failed attempts. Try again later or reset your password.',
};

export const SIGNED_OUT = 'Your Limi sign-in has expired. Sign in again.';

// Firebase puts the code first: "TOO_MANY_ATTEMPTS_TRY_LATER : Access to this
// account has been temporarily disabled…".
function errorCode(body: unknown): string {
  const message = (body as { error?: { message?: string } } | null)?.error?.message ?? '';
  return message.split(/[\s:]/)[0] || 'UNKNOWN';
}

async function post(fetchFn: FetchLike, url: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetchFn(url, { method: 'POST', ...init });
  } catch {
    throw new FirebaseUnavailableError('Could not reach the Limi sign-in service. Try again in a moment.');
  }
  if (isTransient(res.status)) throw new FirebaseUnavailableError();
  const body: unknown = await res.json().catch(() => null);
  return { res, body };
}

export interface SignInResult {
  uid: string;
  idToken: string;
  refreshToken: string;
}

export async function signInWithPassword(
  apiKey: string,
  email: string,
  password: string,
  fetchFn: FetchLike = fetch
): Promise<SignInResult> {
  const { res, body } = await post(
    fetchFn,
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      headers: { 'Content-Type': 'application/json' },
      // Lower-cased like the app's sign-in, so the same address always works.
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const code = errorCode(body);
    throw new FirebaseAuthError(code, SIGN_IN_MESSAGES[code] ?? 'Could not sign in.');
  }
  const ok = body as { localId: string; idToken: string; refreshToken: string };
  return { uid: ok.localId, idToken: ok.idToken, refreshToken: ok.refreshToken };
}

export interface IdToken {
  uid: string;
  idToken: string;
  /** Firebase may hand back a new refresh token; use it from then on. */
  refreshToken: string;
  /** Milliseconds. */
  expiresAt: number;
}

/**
 * Fails with FirebaseAuthError when Google refuses the refresh token (a 4xx:
 * TOKEN_EXPIRED after a password change, USER_DISABLED, USER_NOT_FOUND,
 * INVALID_REFRESH_TOKEN and the like), which callers treat exactly like an
 * expired sign-in. A network failure or a 5xx is FirebaseUnavailableError.
 */
export async function exchangeRefreshToken(
  apiKey: string,
  refreshToken: string,
  fetchFn: FetchLike = fetch,
  now: number = Date.now()
): Promise<IdToken> {
  const { res, body } = await post(
    fetchFn,
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
    }
  );
  if (!res.ok) throw new FirebaseAuthError(errorCode(body), SIGNED_OUT);
  const ok = body as { id_token: string; refresh_token: string; expires_in: string; user_id: string };
  return {
    uid: ok.user_id,
    idToken: ok.id_token,
    refreshToken: ok.refresh_token || refreshToken,
    expiresAt: now + Number(ok.expires_in || 3600) * 1000,
  };
}

const EARLY = 5 * 60_000;

/**
 * ID tokens last an hour. A warm instance keeps each one until five minutes
 * before it expires, so a conversation's tool calls do not each pay for a
 * round trip to Google.
 */
export function createIdTokenCache(apiKey: string, fetchFn: FetchLike = fetch) {
  const cache = new Map<string, IdToken>();
  return async function idTokenFor(refreshToken: string, now: number = Date.now()): Promise<IdToken> {
    const hit = cache.get(refreshToken);
    if (hit && hit.expiresAt - EARLY > now) return hit;
    cache.delete(refreshToken);
    const fresh = await exchangeRefreshToken(apiKey, refreshToken, fetchFn, now);
    cache.set(refreshToken, fresh);
    return fresh;
  };
}
