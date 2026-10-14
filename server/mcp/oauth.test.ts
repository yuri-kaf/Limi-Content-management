// @vitest-environment node
import {
  authorizationServerMetadata, authorizeHandler, createOAuth, isAllowedRedirect, pkceChallenge,
  protectedResourceMetadata, registerHandler, tokenHandler, type GrantClaims, type OAuthDeps,
} from './oauth.js';
import { unseal } from './seal.js';
import { limiGoogle, NOW } from './testData.js';

const ORIGIN = 'https://limi.example';
const KEY = new Uint8Array(32).fill(7);
const CLAUDE_AI = 'https://claude.ai/api/mcp/auth_callback';
const VERIFIER = 'verifier-0123456789-abcdefghijklmnopqrstuvwxyz';

function setup(now = () => NOW) {
  const google = limiGoogle();
  const deps: OAuthDeps = { key: KEY, apiKey: 'test-key', projectId: 'limi-test', fetch: google.fetch, now };
  return {
    google,
    register: registerHandler(deps),
    authorize: authorizeHandler(deps),
    token: tokenHandler(deps),
  };
}

type Setup = ReturnType<typeof setup>;

const jsonPost = (path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

const formPost = (path: string, fields: Record<string, string>) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });

async function registerClient(s: Setup, redirect = CLAUDE_AI): Promise<string> {
  const res = await s.register(jsonPost('/oauth/register', { redirect_uris: [redirect], client_name: 'Claude' }));
  return ((await res.json()) as { client_id: string }).client_id;
}

function authorizeFields(clientId: string, extra: Record<string, string> = {}) {
  return {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: CLAUDE_AI,
    state: 'state-1',
    code_challenge: pkceChallenge(VERIFIER),
    code_challenge_method: 'S256',
    ...extra,
  };
}

async function signIn(s: Setup, clientId: string, email = 'sam@shopit.test', password = 'client-pw') {
  return s.authorize(formPost('/oauth/authorize', { ...authorizeFields(clientId), email, password }));
}

async function codeFor(s: Setup, clientId: string): Promise<string> {
  const res = await signIn(s, clientId);
  return new URL(res.headers.get('Location')!).searchParams.get('code')!;
}

const exchange = (s: Setup, fields: Record<string, string>) => s.token(formPost('/oauth/token', fields));

describe('metadata', () => {
  it('describes the protected resource at the forwarded origin', async () => {
    const req = new Request('http://internal/api/well-known/oauth-protected-resource', {
      headers: { 'x-forwarded-host': 'limi.example', 'x-forwarded-proto': 'https' },
    });
    expect(await protectedResourceMetadata(req).json()).toEqual({
      resource: 'https://limi.example/mcp',
      authorization_servers: ['https://limi.example'],
      bearer_methods_supported: ['header'],
      resource_name: 'Limi',
    });
  });

  it('describes the authorization server', async () => {
    const res = authorizationServerMetadata(new Request(`${ORIGIN}/.well-known/oauth-authorization-server`));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.json()).toEqual({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      registration_endpoint: `${ORIGIN}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });
});

describe('isAllowedRedirect', () => {
  it('allows https and http on localhost only', () => {
    expect(isAllowedRedirect(CLAUDE_AI)).toBe(true);
    expect(isAllowedRedirect('http://localhost:33418/callback')).toBe(true);
    expect(isAllowedRedirect('http://127.0.0.1:5000/callback')).toBe(true);
    expect(isAllowedRedirect('http://evil.example/callback')).toBe(false);
    expect(isAllowedRedirect('https://claude.ai/cb#frag')).toBe(false);
    expect(isAllowedRedirect('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirect('not a url')).toBe(false);
  });
});

describe('register', () => {
  it('returns a client id that seals the redirect URIs', async () => {
    const s = setup();
    const res = await s.register(jsonPost('/oauth/register', { redirect_uris: [CLAUDE_AI], client_name: 'Claude' }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      client_name: 'Claude', redirect_uris: [CLAUDE_AI], token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    });
    expect(await unseal(KEY, 'client', body.client_id as string)).toMatchObject({ ru: [CLAUDE_AI], nm: 'Claude' });
  });

  it('accepts a Claude Code loopback callback', async () => {
    const s = setup();
    const res = await s.register(jsonPost('/oauth/register', { redirect_uris: ['http://localhost:33418/callback'] }));
    expect(res.status).toBe(201);
  });

  it('refuses a redirect it would not trust', async () => {
    const s = setup();
    const res = await s.register(jsonPost('/oauth/register', { redirect_uris: ['http://evil.example/cb'] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_redirect_uri' });
  });

  it('refuses a body that is not JSON', async () => {
    const s = setup();
    const res = await s.register(new Request(`${ORIGIN}/oauth/register`, { method: 'POST', body: 'nope' }));
    expect(await res.json()).toMatchObject({ error: 'invalid_client_metadata' });
  });
});

describe('authorize', () => {
  it('shows the sign-in page for a registered client', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const url = `${ORIGIN}/oauth/authorize?${new URLSearchParams(authorizeFields(clientId))}`;
    const res = await s.authorize(new Request(url));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(await res.text()).toContain('Connect Claude to Limi');
  });

  it('refuses an unregistered redirect_uri without redirecting', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const fields = authorizeFields(clientId, { redirect_uri: 'https://evil.example/cb' });
    const res = await s.authorize(new Request(`${ORIGIN}/oauth/authorize?${new URLSearchParams(fields)}`));
    expect(res.status).toBe(400);
    expect(res.headers.get('Location')).toBeNull();
    expect(await res.text()).toContain('does not recognise');
  });

  it('refuses a client id it did not issue', async () => {
    const s = setup();
    const fields = authorizeFields('made-up');
    const res = await s.authorize(new Request(`${ORIGIN}/oauth/authorize?${new URLSearchParams(fields)}`));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('This sign-in link is not valid.');
  });

  it('sends a request without PKCE back with invalid_request', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const fields = authorizeFields(clientId, { code_challenge_method: 'plain' });
    const res = await s.authorize(new Request(`${ORIGIN}/oauth/authorize?${new URLSearchParams(fields)}`));
    expect(res.status).toBe(302);
    const back = new URL(res.headers.get('Location')!);
    expect(back.origin + back.pathname).toBe(CLAUDE_AI);
    expect(back.searchParams.get('error')).toBe('invalid_request');
    expect(back.searchParams.get('state')).toBe('state-1');
  });

  it('re-renders with the error on a bad password', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const res = await signIn(s, clientId, 'sam@shopit.test', 'wrong');
    expect(res.status).toBe(200);
    expect(res.headers.get('Location')).toBeNull();
    const html = await res.text();
    expect(html).toContain('Invalid email or password.');
    expect(html).toContain('value="sam@shopit.test"');
  });

  it('refuses a good password with no Limi profile', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const res = await signIn(s, clientId, 'nobody@limi.test', 'nobody-pw');
    expect(res.headers.get('Location')).toBeNull();
    expect(await res.text()).toContain('This account has no access to Limi.');
  });

  it('returns to Claude with a code and the state', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const res = await signIn(s, clientId);
    expect(res.status).toBe(302);
    const back = new URL(res.headers.get('Location')!);
    expect(back.origin + back.pathname).toBe(CLAUDE_AI);
    expect(back.searchParams.get('state')).toBe('state-1');
    expect(back.searchParams.get('code')).toBeTruthy();
  });
});

describe('token', () => {
  it('exchanges a code for access and refresh tokens', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const code = await codeFor(s, clientId);
    const res = await exchange(s, {
      grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_AI, code_verifier: VERIFIER,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { access_token: string; refresh_token: string; token_type: string; expires_in: number };
    expect(body).toMatchObject({ token_type: 'Bearer', expires_in: 3600 });
    const access = await unseal<GrantClaims>(KEY, 'access', body.access_token, { audience: `${ORIGIN}/mcp`, now: NOW });
    expect(access).toMatchObject({ uid: 'cli1', rt: 'rt-cli1', cid: clientId });
  });

  it('refuses a wrong PKCE verifier', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const code = await codeFor(s, clientId);
    const res = await exchange(s, {
      grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_AI,
      code_verifier: `${VERIFIER}-wrong`,
    });
    expect(await res.json()).toEqual({ error: 'invalid_grant', error_description: 'PKCE verification failed.' });
  });

  it('refuses an expired code', async () => {
    let now = NOW;
    const s = setup(() => now);
    const clientId = await registerClient(s);
    const code = await codeFor(s, clientId);
    now = NOW + 6 * 60_000;
    const res = await exchange(s, {
      grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_AI, code_verifier: VERIFIER,
    });
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('refuses a code presented by another client or for another redirect', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const otherClient = await registerClient(s, 'http://localhost:4000/callback');
    const code = await codeFor(s, clientId);
    const base = { grant_type: 'authorization_code', code, code_verifier: VERIFIER };
    const wrongClient = await exchange(s, { ...base, client_id: otherClient, redirect_uri: CLAUDE_AI });
    expect(await wrongClient.json()).toMatchObject({ error: 'invalid_grant' });
    const wrongRedirect = await exchange(s, { ...base, client_id: clientId, redirect_uri: 'https://claude.ai/other' });
    expect(await wrongRedirect.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('refreshes, and stops once the Firebase sign-in is revoked', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const code = await codeFor(s, clientId);
    const first = (await (
      await exchange(s, {
        grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_AI, code_verifier: VERIFIER,
      })
    ).json()) as { refresh_token: string };

    const refreshed = await exchange(s, { grant_type: 'refresh_token', refresh_token: first.refresh_token, client_id: clientId });
    expect(refreshed.status).toBe(200);
    const next = (await refreshed.json()) as { access_token: string };
    expect(await unseal(KEY, 'access', next.access_token, { audience: `${ORIGIN}/mcp`, now: NOW })).toMatchObject({
      uid: 'cli1',
    });

    s.google.revoke('cli1');
    const refused = await exchange(s, { grant_type: 'refresh_token', refresh_token: first.refresh_token });
    expect(await refused.json()).toEqual({ error: 'invalid_grant', error_description: 'Sign in to Limi again.' });
  });

  it('refuses an access token offered as a refresh token', async () => {
    const s = setup();
    const clientId = await registerClient(s);
    const code = await codeFor(s, clientId);
    const first = (await (
      await exchange(s, {
        grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_AI, code_verifier: VERIFIER,
      })
    ).json()) as { access_token: string };
    const res = await exchange(s, { grant_type: 'refresh_token', refresh_token: first.access_token });
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('refuses other grant types', async () => {
    const s = setup();
    const res = await exchange(s, { grant_type: 'client_credentials' });
    expect(await res.json()).toMatchObject({ error: 'unsupported_grant_type' });
  });
});

describe('createOAuth', () => {
  it('answers 503 everywhere until MCP_TOKEN_SECRET is set', async () => {
    const oauth = createOAuth({ env: { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' } });
    for (const handler of [oauth.register, oauth.authorize, oauth.token]) {
      const res = await handler(new Request(`${ORIGIN}/oauth/token`, { method: 'POST' }));
      expect(res.status).toBe(503);
      expect(await res.text()).toContain('MCP_TOKEN_SECRET is not set');
    }
  });
});
