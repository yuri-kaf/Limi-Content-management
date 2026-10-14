// @vitest-environment node
import {
  authorizationServerMetadata, authorizeHandler, isAllowedRedirect, pkceChallenge, protectedResourceMetadata,
  registerHandler, type OAuthDeps,
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
  return { google, register: registerHandler(deps), authorize: authorizeHandler(deps) };
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
