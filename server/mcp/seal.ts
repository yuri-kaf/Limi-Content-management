import { EncryptJWT, jwtDecrypt } from 'jose';

// There is no token database. Everything the server needs travels inside a
// sealed blob: a JWE encrypted with `dir` + `A256GCM` under MCP_TOKEN_SECRET,
// so the holder can neither read nor alter it. The kind is sealed in too, so
// a sign-in code can never be replayed as an access token, or the reverse.
export type SealKind = 'client' | 'code' | 'access' | 'refresh';

const ALG = 'dir';
const ENC = 'A256GCM';

export interface SealOptions {
  /** Lifetime in seconds. Omitted means the blob never expires (client ids). */
  ttlSeconds?: number;
  /** Binds the blob to one resource, e.g. https://host/mcp. */
  audience?: string;
  /** Milliseconds; for tests. */
  now?: number;
}

export async function seal(
  key: Uint8Array,
  kind: SealKind,
  payload: Record<string, unknown>,
  options: SealOptions = {}
): Promise<string> {
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const jwt = new EncryptJWT({ ...payload, knd: kind })
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setIssuedAt(now);
  if (options.ttlSeconds !== undefined) jwt.setExpirationTime(now + options.ttlSeconds);
  if (options.audience) jwt.setAudience(options.audience);
  return jwt.encrypt(key);
}

/**
 * The payload, or null when the blob is malformed, tampered with, sealed under
 * another key, expired, of another kind or for another audience. Callers never
 * need to tell those apart: each one means "sign in again".
 */
export async function unseal<T extends object>(
  key: Uint8Array,
  kind: SealKind,
  token: string | null | undefined,
  options: { audience?: string; now?: number } = {}
): Promise<(T & { exp?: number }) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, key, {
      keyManagementAlgorithms: [ALG],
      contentEncryptionAlgorithms: [ENC],
      ...(options.audience ? { audience: options.audience } : {}),
      ...(options.now !== undefined ? { currentDate: new Date(options.now) } : {}),
    });
    if (payload.knd !== kind) return null;
    return payload as unknown as T & { exp?: number };
  } catch {
    return null;
  }
}
