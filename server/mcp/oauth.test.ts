// @vitest-environment node
import {
  authorizationServerMetadata, isAllowedRedirect, protectedResourceMetadata, registerHandler, type OAuthDeps,
} from './oauth.js';
import { unseal } from './seal.js';
import { limiGoogle, NOW } from './testData.js';

const ORIGIN = 'https://limi.example';
const KEY = new Uint8Array(32).fill(7);
const CLAUDE_AI = 'https://claude.ai/api/mcp/auth_callback';

function setup(now = () => NOW) {
  const google = limiGoogle();
  const deps: OAuthDeps = { key: KEY, apiKey: 'test-key', projectId: 'limi-test', fetch: google.fetch, now };
  return { google, register: registerHandler(deps) };
}

const jsonPost = (path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

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
