import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { notConfigured, readEnv } from './env.js';
import { unseal } from './seal.js';
import { createIdTokenCache, FirebaseAuthError, FirebaseUnavailableError, type FetchLike } from './firebaseAuth.js';
import { createFirestore } from './firestore.js';
import { getProfile, LimiError, plainMessage, type Session } from './limi.js';
import { PROTECTED_RESOURCE_PATH, resourceUrl, type GrantClaims } from './oauth.js';
import { runTool, TOOLS } from './tools.js';

const INSTRUCTIONS = [
  "Limi is a social media agency's content system: clients, their businesses, posts moving through",
  'Editing, Review, To Post and Posted, campaigns and ideas. You act as the signed-in person and see',
  'only what they can see. Dates are Kathmandu time (UTC+5:45). Before any tool that changes data,',
  'tell the person exactly what will change and wait for them to confirm. Nothing can be deleted here.',
].join(' ');

/**
 * A browser-based client sends a preflight before its first POST, without the
 * bearer token, so it is answered here, ahead of the auth check.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

const preflight = () => new Response(null, { status: 204, headers: CORS });

/** What a verified access token leaves on the request for the tools. */
interface LimiAuth {
  uid: string;
  idToken: string;
}

/**
 * The /mcp endpoint: stateless Streamable HTTP behind a bearer check. A token
 * that is missing, expired, sealed for another deployment, or whose Firebase
 * sign-in has been revoked (a changed password, a disabled account) gets a
 * 401 whose WWW-Authenticate names the resource metadata, so Claude signs in
 * again.
 */
export function createMcpEndpoint(
  options: { env?: Record<string, string | undefined>; fetch?: FetchLike; now?: () => number } = {}
): (req: Request) => Promise<Response> {
  const config = readEnv(options.env);
  if (!config.ok) {
    const message = config.message;
    return async () => notConfigured(message);
  }
  const { key, apiKey, projectId } = config.env;
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const idTokenFor = createIdTokenCache(apiKey, fetchFn);
  // withMcpAuth turns any verification failure into a 401, which makes Claude
  // sign in again. A Google outage is not a reason to: the requests it hit are
  // remembered here and answered 503 instead.
  const outage = new WeakSet<Request>();

  async function verifyToken(req: Request, bearer?: string): Promise<AuthInfo | undefined> {
    const grant = await unseal<GrantClaims>(key, 'access', bearer, { audience: resourceUrl(req), now: now() });
    if (!grant) return undefined;
    try {
      const { idToken } = await idTokenFor(grant.rt, now());
      return { token: bearer!, clientId: grant.cid, scopes: [], extra: { uid: grant.uid, idToken } satisfies LimiAuth };
    } catch (err) {
      if (err instanceof FirebaseAuthError) return undefined;
      if (err instanceof FirebaseUnavailableError) {
        outage.add(req);
        return undefined;
      }
      throw err;
    }
  }

  async function sessionFor(auth: AuthInfo | undefined): Promise<Session> {
    const limi = auth?.extra as LimiAuth | undefined;
    if (!limi) throw new LimiError('Sign in to Limi again.');
    const fs = createFirestore({ projectId, idToken: limi.idToken, fetch: fetchFn });
    // Removing someone on the Team page deletes this profile, which ends their access.
    const profile = await getProfile(fs, limi.uid);
    if (!profile) throw new LimiError('This login no longer has access to Limi. Ask an admin to add you on the Team page.');
    return { fs, profile, now };
  }

  const mcp = createMcpHandler(
    (server) => {
      for (const tool of TOOLS) {
        server.registerTool(
          tool.name,
          {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.input,
            annotations: {
              title: tool.title,
              readOnlyHint: tool.readOnly,
              destructiveHint: tool.destructive ?? false,
              idempotentHint: tool.readOnly,
              openWorldHint: false,
            },
          },
          async (args: unknown, ctx) => {
            let session: Session;
            try {
              session = await sessionFor(ctx.http?.authInfo);
            } catch (err) {
              return { content: [{ type: 'text', text: plainMessage(err) }], isError: true };
            }
            return runTool(tool, session, args);
          }
        );
      }
    },
    { serverInfo: { name: 'limi', version: '1.0.0' }, instructions: INSTRUCTIONS }
  );

  const authed = withMcpAuth(mcp, verifyToken, { required: true, resourceMetadataPath: PROTECTED_RESOURCE_PATH });
  return async (req) => {
    if (req.method === 'OPTIONS') return preflight();
    const res = await authed(req);
    if (res.status === 401 && outage.has(req)) {
      return new Response('Limi could not reach Google just now. Try again in a moment.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5' },
      });
    }
    return res;
  };
}
