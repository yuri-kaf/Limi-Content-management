import { createHash } from 'node:crypto';
import { getPublicOrigin } from 'mcp-handler';
import { seal, unseal } from './seal.js';
import { FirebaseAuthError, signInWithPassword, type FetchLike } from './firebaseAuth.js';
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
