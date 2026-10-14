// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

const apiFiles = filesUnder(join(ROOT, 'api')).map((f) => relative(ROOT, f).replace(/\\/g, '/'));

describe('api/', () => {
  // Every file in api/ is deployed as a function, tests included.
  it('holds no tests and nothing but thin adapters', () => {
    expect(apiFiles.sort()).toEqual([
      'api/mcp.ts',
      'api/oauth/authorize.ts',
      'api/oauth/register.ts',
      'api/oauth/token.ts',
      'api/well-known/oauth-authorization-server.ts',
      'api/well-known/oauth-protected-resource.ts',
    ]);
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    rewrites: { source: string; destination: string }[];
  };
  const destinationOf = (path: string) =>
    config.rewrites.find((r) => new RegExp(`^${r.source}$`).test(path))?.destination;

  it('routes every connector path to its function, ahead of the app', () => {
    expect(destinationOf('/mcp')).toBe('/api/mcp');
    expect(destinationOf('/oauth/register')).toBe('/api/oauth/register');
    expect(destinationOf('/oauth/authorize')).toBe('/api/oauth/authorize');
    expect(destinationOf('/oauth/token')).toBe('/api/oauth/token');
    expect(destinationOf('/.well-known/oauth-protected-resource')).toBe('/api/well-known/oauth-protected-resource');
    expect(destinationOf('/.well-known/oauth-protected-resource/mcp')).toBe('/api/well-known/oauth-protected-resource');
    expect(destinationOf('/.well-known/oauth-authorization-server')).toBe('/api/well-known/oauth-authorization-server');
  });

  it('sends everything else to the app, except api/ and .well-known/', () => {
    expect(destinationOf('/content')).toBe('/index.html');
    expect(destinationOf('/api/unknown')).toBeUndefined();
    expect(destinationOf('/.well-known/openid-configuration')).toBeUndefined();
  });

  it('points every rewrite at a function that exists', () => {
    for (const { destination } of config.rewrites.filter((r) => r.destination.startsWith('/api/'))) {
      expect(apiFiles).toContain(`${destination.slice(1)}.ts`);
    }
  });
});
