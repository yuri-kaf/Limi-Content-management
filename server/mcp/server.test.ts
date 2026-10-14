// @vitest-environment node
import { seal } from './seal.js';
import { createMcpEndpoint } from './server.js';
import { limiGoogle, NOW } from './testData.js';

const KEY = new Uint8Array(32).fill(7);
const ENV = {
  MCP_TOKEN_SECRET: Buffer.from(KEY).toString('base64'),
  VITE_FIREBASE_API_KEY: 'test-key',
  VITE_FIREBASE_PROJECT_ID: 'limi-test',
};
const MCP = 'https://limi.example/mcp';

function setup() {
  const google = limiGoogle();
  const handle = createMcpEndpoint({ env: ENV, fetch: google.fetch, now: () => NOW });
  return { google, handle };
}

const accessToken = (uid: string, audience = MCP) =>
  seal(KEY, 'access', { rt: `rt-${uid}`, uid, cid: 'client-1' }, { ttlSeconds: 3600, audience, now: NOW });

async function rpc(handle: (req: Request) => Promise<Response>, token: string | null, method: string, params?: unknown) {
  const res = await handle(
    new Request(MCP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
    })
  );
  const text = await res.text();
  // Stateless Streamable HTTP answers a request as one server-sent event.
  const data = text.split('\n').find((line) => line.startsWith('data: '));
  return { res, body: data ? JSON.parse(data.slice('data: '.length)) : null };
}

const WWW = 'resource_metadata="https://limi.example/.well-known/oauth-protected-resource/mcp"';

describe('the MCP endpoint', () => {
  it('answers 503 until MCP_TOKEN_SECRET is set', async () => {
    const handle = createMcpEndpoint({ env: { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' } });
    const res = await handle(new Request(MCP, { method: 'POST' }));
    expect(res.status).toBe(503);
  });

  it('asks for sign-in without a token', async () => {
    const { handle } = setup();
    const { res } = await rpc(handle, null, 'tools/list');
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain(WWW);
  });

  it('asks for sign-in with a token it cannot open', async () => {
    const { handle } = setup();
    const { res } = await rpc(handle, 'garbage', 'tools/list');
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain(WWW);
  });

  it('refuses a token sealed for another deployment', async () => {
    const { handle } = setup();
    const { res } = await rpc(handle, await accessToken('admin1', 'https://preview.example/mcp'), 'tools/list');
    expect(res.status).toBe(401);
  });

  it('treats a revoked Firebase sign-in as signed out', async () => {
    const { google, handle } = setup();
    google.revoke('admin1');
    const { res } = await rpc(handle, await accessToken('admin1'), 'tools/list');
    expect(res.status).toBe(401);
  });

  it('lists the tools, marking which ones change data', async () => {
    const { handle } = setup();
    const { res, body } = await rpc(handle, await accessToken('admin1'), 'tools/list');
    expect(res.status).toBe(200);
    const tools = body.result.tools as { name: string; annotations: { readOnlyHint: boolean } }[];
    expect(tools).toHaveLength(13);
    expect(tools.find((t) => t.name === 'get_today')!.annotations.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === 'move_content')!.annotations.readOnlyHint).toBe(false);
  });

  it('runs a tool as the signed-in person', async () => {
    const { handle } = setup();
    const { body } = await rpc(handle, await accessToken('cli1'), 'tools/call', { name: 'whoami', arguments: {} });
    expect(JSON.parse(body.result.content[0].text)).toMatchObject({ name: 'Sam Shopit', role: 'client' });
  });

  it('says so plainly when the profile is gone', async () => {
    const { handle } = setup();
    // ghost has a working Firebase sign-in but no users/{uid} profile.
    const { body } = await rpc(handle, await accessToken('ghost'), 'tools/call', { name: 'whoami', arguments: {} });
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toBe(
      'This login no longer has access to Limi. Ask an admin to add you on the Team page.'
    );
  });

  it('passes a rules refusal back as the plain message', async () => {
    const { handle } = setup();
    const { body } = await rpc(handle, await accessToken('cli1'), 'tools/call', {
      name: 'move_content', arguments: { id: 'momo', stage: 'posted' },
    });
    expect(body.result).toEqual({
      content: [{ type: 'text', text: "Your Limi role can't do that." }],
      isError: true,
    });
  });
});
