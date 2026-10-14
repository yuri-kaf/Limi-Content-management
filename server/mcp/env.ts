// The team works in Kathmandu (UTC+5:45). Set when this module loads, before
// any request is handled, so the day-based helpers shared with the app
// (isLate, isDueWithin, buildToday, slotLabel) count days the way the app
// does, and a date a tool is given is read as Kathmandu local time.
process.env.TZ = 'Asia/Kathmandu';

export interface LimiEnv {
  /** The 32-byte key every sealed token is encrypted with. */
  key: Uint8Array;
  /** Firebase web API key: the same public value the app is built with. */
  apiKey: string;
  projectId: string;
}

export type EnvResult = { ok: true; env: LimiEnv } | { ok: false; message: string };

/** MCP_TOKEN_SECRET is 32 random bytes in base64. Anything else is refused. */
export function keyFromSecret(secret: string): Uint8Array {
  const bytes = Buffer.from(secret.trim(), 'base64');
  if (bytes.length !== 32) throw new Error('MCP_TOKEN_SECRET must be 32 random bytes in base64.');
  return new Uint8Array(bytes);
}

export function readEnv(source: Record<string, string | undefined> = process.env): EnvResult {
  const secret = source.MCP_TOKEN_SECRET?.trim();
  const apiKey = source.VITE_FIREBASE_API_KEY?.trim();
  const projectId = source.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!secret) {
    return { ok: false, message: 'The Limi connector is not switched on yet: MCP_TOKEN_SECRET is not set.' };
  }
  if (!apiKey || !projectId) {
    return { ok: false, message: 'The Limi connector is missing its Firebase settings.' };
  }
  try {
    return { ok: true, env: { key: keyFromSecret(secret), apiKey, projectId } };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/** What every endpoint answers while the connector is not configured. */
export function notConfigured(message: string): Response {
  return new Response(message, {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
