import { getPublicOrigin } from 'mcp-handler';
import { seal } from './seal.js';
import type { FetchLike } from './firebaseAuth.js';

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
