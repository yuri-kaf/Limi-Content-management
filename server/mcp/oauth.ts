import { createHash } from 'node:crypto';
import { getPublicOrigin } from 'mcp-handler';
import { notConfigured, readEnv } from './env.js';
import { seal, unseal } from './seal.js';
import { exchangeRefreshToken, FirebaseAuthError, signInWithPassword, type FetchLike } from './firebaseAuth.js';
import { createFirestore } from './firestore.js';
import { getProfile } from './limi.js';
import { renderErrorPage, renderSignInPage, type SignInFields } from './signInPage.js';

// OAuth 2.1 for the MCP connector, per the MCP authorization spec (2025-06-18):
// RFC 9728 protected-resource metadata, RFC 8414 server metadata, RFC 7591
// dynamic client registration, the authorization code grant with PKCE (S256
// only) for public clients, and refresh tokens. Stateless: the client id, the
// code and both tokens are sealed blobs (seal.ts), so nothing is stored.

/** Where the MCP endpoint's 401 points (RFC 9728's path-suffixed form). */
export const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';

/** The public origin, read through Vercel's forwarding headers. */
export function publicOrigin(req: Request): string {
  return getPublicOrigin(req);
}

/** The MCP endpoint's URL: the audience every token is sealed for. */
export function resourceUrl(req: Request): string {
  return `${publicOrigin(req)}/mcp`;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...headers },
  });
}

function oauthError(error: string, description: string, status = 400): Response {
  return json({ error, error_description: description }, status);
}

const preflight = () => new Response(null, { status: 204, headers: CORS });
const notAllowed = (allow: string) =>
  new Response('Method not allowed', { status: 405, headers: { Allow: allow, ...CORS } });

type Handler = (req: Request) => Promise<Response>;

/** Everything the handlers need; tests pass a fake fetch and a fixed clock. */
export interface OAuthDeps {
  key: Uint8Array;
  apiKey: string;
  projectId: string;
  fetch: FetchLike;
  now: () => number;
}

// ─── Metadata ────────────────────────────────────────────────────────────────

/** RFC 9728, served at /.well-known/oauth-protected-resource and …/mcp. */
export function protectedResourceMetadata(req: Request): Response {
  if (req.method === 'OPTIONS') return preflight();
  const origin = publicOrigin(req);
  return json(
    {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
      resource_name: 'Limi',
    },
    200,
    { 'Cache-Control': 'public, max-age=3600' }
  );
}

/** RFC 8414, served at /.well-known/oauth-authorization-server. */
export function authorizationServerMetadata(req: Request): Response {
  if (req.method === 'OPTIONS') return preflight();
  const origin = publicOrigin(req);
  return json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    },
    200,
    { 'Cache-Control': 'public, max-age=3600' }
  );
}

// ─── Registration (RFC 7591) ─────────────────────────────────────────────────

/**
 * Claude.ai returns to an https URL (https://claude.ai/api/mcp/auth_callback),
 * Claude Code to http://localhost:<port>/callback. Nothing else is accepted.
 */
export function isAllowedRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

/** A client id is a sealed copy of what the client registered. */
interface ClientClaims {
  ru: string[];
  nm: string;
}

export function registerHandler({ key, now }: OAuthDeps): Handler {
  return async (req) => {
    if (req.method === 'OPTIONS') return preflight();
    if (req.method !== 'POST') return notAllowed('POST, OPTIONS');
    const body = (await req.json().catch(() => null)) as { redirect_uris?: unknown; client_name?: unknown } | null;
    if (!body || typeof body !== 'object') {
      return oauthError('invalid_client_metadata', 'The registration must be a JSON object.');
    }
    const uris = body.redirect_uris;
    if (
      !Array.isArray(uris) ||
      uris.length === 0 ||
      uris.length > 10 ||
      !uris.every((u): u is string => typeof u === 'string' && isAllowedRedirect(u))
    ) {
      return oauthError('invalid_redirect_uri', 'Redirect URIs must use https, or http on localhost.');
    }
    const name =
      typeof body.client_name === 'string' && body.client_name.trim()
        ? body.client_name.trim().slice(0, 80)
        : 'Claude';
    const clientId = await seal(key, 'client', { ru: uris, nm: name } satisfies ClientClaims, { now: now() });
    return json(
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(now() / 1000),
        client_name: name,
        redirect_uris: uris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
      201
    );
  };
}

// ─── Authorization ───────────────────────────────────────────────────────────

const CODE_TTL = 5 * 60;

/** A sign-in code: valid five minutes, for one client, one redirect and one PKCE challenge. */
interface CodeClaims {
  rt: string;
  uid: string;
  cid: string;
  ru: string;
  cc: string;
}

/** RFC 7636 S256: BASE64URL(SHA256(verifier)). */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function redirectTo(base: string, params: Record<string, string>): Response {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString(), 'Cache-Control': 'no-store' } });
}

type Checked = { ok: true; fields: SignInFields; clientName: string } | { ok: false; response: Response };

async function checkRequest(key: Uint8Array, params: URLSearchParams): Promise<Checked> {
  const fields: SignInFields = {
    client_id: params.get('client_id') ?? '',
    redirect_uri: params.get('redirect_uri') ?? '',
    state: params.get('state') ?? '',
    code_challenge: params.get('code_challenge') ?? '',
    code_challenge_method: params.get('code_challenge_method') ?? '',
    response_type: params.get('response_type') ?? '',
  };
  const client = await unseal<ClientClaims>(key, 'client', fields.client_id);
  if (!client) {
    return {
      ok: false,
      response: renderErrorPage(400, 'This sign-in link is not valid. Start connecting again from Claude.'),
    };
  }
  // Never redirect anywhere the client did not register: show the error here.
  if (!client.ru.includes(fields.redirect_uri)) {
    return {
      ok: false,
      response: renderErrorPage(
        400,
        'This sign-in link asks to return somewhere Limi does not recognise. Start connecting again from Claude.'
      ),
    };
  }
  if (fields.response_type !== 'code') {
    return {
      ok: false,
      response: redirectTo(fields.redirect_uri, { error: 'unsupported_response_type', state: fields.state }),
    };
  }
  if (!fields.code_challenge || fields.code_challenge_method !== 'S256') {
    return {
      ok: false,
      response: redirectTo(fields.redirect_uri, {
        error: 'invalid_request',
        error_description: 'PKCE with S256 is required.',
        state: fields.state,
      }),
    };
  }
  return { ok: true, fields, clientName: client.nm };
}

/** GET shows the sign-in page; POST signs in and returns to Claude with a code. */
export function authorizeHandler({ key, apiKey, projectId, fetch: fetchFn, now }: OAuthDeps): Handler {
  return async (req) => {
    if (req.method === 'GET') {
      const checked = await checkRequest(key, new URL(req.url).searchParams);
      if (!checked.ok) return checked.response;
      return renderSignInPage({ fields: checked.fields, clientName: checked.clientName });
    }
    if (req.method !== 'POST') return notAllowed('GET, POST');

    const form = new URLSearchParams(await req.text());
    const checked = await checkRequest(key, form);
    if (!checked.ok) return checked.response;
    const { fields, clientName } = checked;
    const email = (form.get('email') ?? '').trim();
    const password = form.get('password') ?? '';
    const again = (error: string) => renderSignInPage({ fields, clientName, email, error });
    if (!email || !password) return again('Enter your email and password.');

    let signedIn;
    try {
      signedIn = await signInWithPassword(apiKey, email, password, fetchFn);
    } catch (err) {
      return again(err instanceof FirebaseAuthError ? err.message : 'Could not sign in.');
    }
    // A Firebase account is not enough: the users/{uid} profile is what grants access.
    const fs = createFirestore({ projectId, idToken: signedIn.idToken, fetch: fetchFn });
    const profile = await getProfile(fs, signedIn.uid).catch(() => null);
    if (!profile) return again('This account has no access to Limi. Ask an admin to add you on the Team page.');

    const code = await seal(
      key,
      'code',
      {
        rt: signedIn.refreshToken,
        uid: signedIn.uid,
        cid: fields.client_id,
        ru: fields.redirect_uri,
        cc: fields.code_challenge,
      } satisfies CodeClaims,
      { ttlSeconds: CODE_TTL, now: now() }
    );
    return redirectTo(fields.redirect_uri, { code, state: fields.state });
  };
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

const ACCESS_TTL = 60 * 60;
const REFRESH_TTL = 90 * 24 * 60 * 60;

/** What an access or refresh token carries. */
export interface GrantClaims {
  /** The person's Firebase refresh token. */
  rt: string;
  uid: string;
  /** The OAuth client id it was issued to. */
  cid: string;
}

export function tokenHandler({ key, apiKey, fetch: fetchFn, now }: OAuthDeps): Handler {
  async function issue(req: Request, claims: GrantClaims): Promise<Response> {
    // Both tokens are bound to this deployment's /mcp, so one sealed for a
    // preview deployment is refused by production, and the reverse.
    const audience = resourceUrl(req);
    const grant = { rt: claims.rt, uid: claims.uid, cid: claims.cid } satisfies GrantClaims;
    const [accessToken, refreshToken] = await Promise.all([
      seal(key, 'access', grant, { ttlSeconds: ACCESS_TTL, audience, now: now() }),
      seal(key, 'refresh', grant, { ttlSeconds: REFRESH_TTL, audience, now: now() }),
    ]);
    return json({ access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refreshToken });
  }

  return async (req) => {
    if (req.method === 'OPTIONS') return preflight();
    if (req.method !== 'POST') return notAllowed('POST, OPTIONS');
    const form = new URLSearchParams(await req.text());
    const grantType = form.get('grant_type');

    if (grantType === 'authorization_code') {
      const code = await unseal<CodeClaims>(key, 'code', form.get('code'), { now: now() });
      if (!code) return oauthError('invalid_grant', 'The sign-in code is not valid or has expired.');
      if (code.cid !== form.get('client_id')) return oauthError('invalid_grant', 'The code was issued to another client.');
      if (code.ru !== form.get('redirect_uri')) return oauthError('invalid_grant', 'The redirect_uri does not match.');
      const verifier = form.get('code_verifier') ?? '';
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || pkceChallenge(verifier) !== code.cc) {
        return oauthError('invalid_grant', 'PKCE verification failed.');
      }
      return issue(req, { rt: code.rt, uid: code.uid, cid: code.cid });
    }

    if (grantType === 'refresh_token') {
      const grant = await unseal<GrantClaims>(key, 'refresh', form.get('refresh_token'), {
        audience: resourceUrl(req),
        now: now(),
      });
      if (!grant) return oauthError('invalid_grant', 'The refresh token is not valid or has expired.');
      const clientId = form.get('client_id');
      if (clientId && clientId !== grant.cid) return oauthError('invalid_grant', 'The token was issued to another client.');
      // A changed password or a disabled account ends the connection here.
      let fresh;
      try {
        fresh = await exchangeRefreshToken(apiKey, grant.rt, fetchFn, now());
      } catch (err) {
        if (err instanceof FirebaseAuthError) return oauthError('invalid_grant', 'Sign in to Limi again.');
        throw err;
      }
      return issue(req, { rt: fresh.refreshToken, uid: grant.uid, cid: grant.cid });
    }

    return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token.');
  };
}

// ─── Wiring ──────────────────────────────────────────────────────────────────

/** The three handlers that need the secret, or a plain 503 from each while it is missing. */
export function createOAuth(
  options: { env?: Record<string, string | undefined>; fetch?: FetchLike; now?: () => number } = {}
): { register: Handler; authorize: Handler; token: Handler } {
  const config = readEnv(options.env);
  if (!config.ok) {
    const off: Handler = async () => notConfigured(config.message);
    return { register: off, authorize: off, token: off };
  }
  const deps: OAuthDeps = { ...config.env, fetch: options.fetch ?? fetch, now: options.now ?? Date.now };
  return { register: registerHandler(deps), authorize: authorizeHandler(deps), token: tokenHandler(deps) };
}
