# Limi MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Claude (Claude.ai on web and phone, the desktop app, Claude Code) read and change Limi as the signed-in person, through a remote MCP server at `/mcp` on the existing Vercel project:

- seven read tools and six write tools, none of which deletes anything;
- OAuth 2.1 sign-in with Limi's own email and password, so setup is "paste the URL, sign in";
- every Firestore call made with the person's own Firebase ID token, so `firestore.rules` bound Claude exactly as they bound the app.

**Architecture:**

- **Thin adapters, testable logic.** Every file in `api/` is a three-line Vercel function (`export default { fetch }`). All logic lives in `server/mcp/` as request → response functions with an injectable `fetch` and clock, tested under Vitest against an in-memory fake of Google's APIs. Nothing touches live Firebase.
- **Stateless OAuth.** The client id, the sign-in code and both tokens are JWE blobs (`dir` + `A256GCM`, `jose`) sealed under `MCP_TOKEN_SECRET`. The access token carries the person's Firebase refresh token; `/mcp` exchanges it for an ID token (cached per warm instance) and calls Firestore REST with it.
- **MCP transport.** `mcp-handler` 2 (Vercel's framework-agnostic adapter over MCP SDK v2) gives a Web `Request → Response` handler serving stateless Streamable HTTP, and `withMcpAuth` answers 401 with the RFC 9728 `WWW-Authenticate` challenge.
- **Shared helpers, not copies.** The server imports `getMediaInfo`, `businessIdOf`, `campaignIdOf`, `scopeContent`, `campaignProgress`, `isLate`, `isDueWithin`, `buildToday`, `todaySources`, `STAGES` and the rest straight from `src/`. Node's ESM loader needs explicit `.js` extensions, so the few `src/` files on that import path get them, and `tsconfig.server.json` (NodeNext) refuses any import without one.
- **Time zone.** `server/mcp/env.ts` sets `process.env.TZ = 'Asia/Kathmandu'` when it loads; every server module imports it first.

**Tech Stack:** TypeScript 5.9, Node 20 (Vercel functions), Vite 5, Vitest 1.6, `mcp-handler` 2.3.0, `@modelcontextprotocol/server` 2.3.1, `zod` 4.6.7, `jose` 6.2.12, Firebase Auth and Firestore REST over `fetch`.

**Spec:** `docs/superpowers/specs/2026-10-14-mcp-server-design.md`

---

## Library facts this plan relies on

Checked by installing the packages in a scratch directory outside the repo and reading their `.d.ts` files and READMEs, then by running every task's code there: all 741 tests pass (599 existing plus 142 new), both `tsc` runs are clean, `npm run build` succeeds, and the compiled `api/` functions load and answer under plain Node ESM.

- **`mcp-handler@2.3.0`** is framework-agnostic: `createMcpHandler(init, options)` returns `(request: Request) => Promise<Response>`. Its peers are `@modelcontextprotocol/server@^2` (required) and `next` (optional, so it is not installed). It needs `zod@^4.2`. It serves the 2026-07-28 protocol and falls back to stateless Streamable HTTP for 2025-era clients (the SDK's `sessionIdGenerator: undefined` idiom), answering each request as one `text/event-stream` event.
  - `withMcpAuth(handler, verifyToken, { required, resourceMetadataPath })` calls `verifyToken(req, bearer)`. `undefined` or a throw gives 401 with `WWW-Authenticate: Bearer error="invalid_token", …, resource_metadata="<origin><resourceMetadataPath>"`. The origin comes from `X-Forwarded-Host`/`X-Forwarded-Proto`, which Vercel sets (`getPublicOrigin`, also exported).
  - The verified `AuthInfo` reaches each tool callback as `ctx.http?.authInfo`. `AuthInfo.extra` carries our own data.
  - `server.registerTool(name, { title, description, inputSchema: z.object(…), annotations }, (args, ctx) => CallToolResult)`. The raw-shape form is deprecated in SDK v2.
- **`@modelcontextprotocol/server@2.3.1`** is the SDK v2 server package (`@modelcontextprotocol/sdk` 1.x is what `mcp-handler` 1.x uses; it is not needed). `ServerOptions` accepts `instructions`.
- **`jose@6.2.12`:** `new EncryptJWT(payload).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).setIssuedAt(n).setExpirationTime(n).setAudience(a).encrypt(key32)`; `jwtDecrypt(token, key, { keyManagementAlgorithms, contentEncryptionAlgorithms, audience, currentDate })` throws `JWEDecryptionFailed`, `JWTExpired` or `JWTClaimValidationFailed`.
- **Vercel functions:** a file in `api/` exporting `default { fetch(request: Request) }` is a Node function with the Web signature, in any project, Vite included. No `@vercel/node` types are needed. Rewrites are checked after the filesystem and in order, so the connector rewrites sit ahead of the SPA catch-all.
- **Two Vercel build hazards, handled in Task 1:**
  - The package is `"type": "module"`, and Vercel compiles each `.ts` file without bundling, so a relative import without `.js` fails at runtime with `ERR_MODULE_NOT_FOUND`. That applies to the `src/` files the server imports too.
  - Vercel's TypeScript compile turns `noEmit` off, and `allowImportingTsExtensions` is only legal with `noEmit`. The root `tsconfig.json` uses it for a single import in `src/main.tsx`.
- **Vitest** already picks up `server/**/*.test.ts` with its default `include`. Server tests declare `// @vitest-environment node`. `vite.config.ts` already runs tests in `Asia/Kathmandu`.

## Deviations from the spec

Each is deliberate; the reason is given.

1. **SDK package.** `mcp-handler` 2.x is built on MCP SDK v2, which ships the server as `@modelcontextprotocol/server` (with `zod` 4), not `@modelcontextprotocol/sdk`. `mcp-handler` fits a plain Vercel function as it is, because it returns a Web handler; there is no need to drive `StreamableHTTPServerTransport` by hand.
2. **Extra files.**
   - `server/mcp/env.ts` holds the time zone, the secret parsing and the 503.
   - `server/mcp/server.ts` holds the `/mcp` wiring, which the spec's table left unplaced.
   - `server/mcp/signInPage.ts` takes the HTML out of `oauth.ts`.
   - `server/mcp/fakeGoogle.ts` and `server/mcp/testData.ts` are test support.
3. **Firestore client.**
   - There is no `query`: every read is a collection `list` filtered in memory, which also avoids the composite indexes `runQuery` filters can need.
   - Updates use `:commit` with an update mask instead of `PATCH`, so a new version can be appended atomically (`appendMissingElements`, the REST form of `arrayUnion`).
4. **Small `src/` edits.**
   - `.js` extensions in five files, so Node can load them inside a function.
   - `./App` instead of `./App.tsx` in `main.tsx`, so `allowImportingTsExtensions`, which Vercel's function compile rejects, can go.
   - No behaviour changes.
5. **Tokens are bound to the deployment.** Access and refresh tokens are sealed with the audience `https://<host>/mcp` and refused anywhere else. A `resource` parameter sent by the client is not needed for that and is ignored.
6. **Codes are not single-use.** Stateless codes can be replayed within their five minutes. Only the holder of the PKCE verifier can redeem one, which is the protection OAuth 2.1 relies on for public clients.
7. **The app's own rules for clients, applied by the tools too.**
   - A client login never sees posts in Editing, team notes or campaign briefs.
   - `review_content` refuses a client acting on a post that is not in Review.
   - These come from the workspace, the detail view and the portal spec.
8. **Tool details.**
   - `get_content`, `update_content`, `move_content`, `review_content` and `add_comment` take a post `id` only; ids are unique across clients.
   - `create_content` also takes `media_type` (read from the link when omitted) and `notes`. Its link is optional, so a post can be planned before the media exists.
   - `get_today` returns the four groups the spec names (needs review, needs rework, going out soon, overdue).
9. **Logo.** The page draws the app's fallback mark (a red square with an "L") in CSS. `public/limi-logo.png` and `public/limi-icon.png` are not in git, so a deployment has no image to serve.
10. **Registration style.** The MCP 2026-07-28 revision prefers Client ID Metadata Documents to dynamic registration. Clients still fall back to registration when the server's metadata offers a `registration_endpoint` and no CIMD support, which is what this server does. The end-to-end check in Task 15 confirms it with Claude.ai.

## Conventions for every task

- **Branch:** `claude/gifted-goldberg-3yf5wj`, in `C:\Users\ashim\Limi-Content-management`. Other sessions commit here too, so run `git status` and `git log --oneline -1` before each commit.
- **Shell:** run the commands below in Bash (Git Bash on this machine), from the repo root.
- **Run one test file:** `npx vitest run server/mcp/<name>.test.ts`.
- **Run everything:** `npm test`. Before this plan it reports **599** tests; the expected total is given after each task.
- **Types:** `npx tsc --noEmit` (the app) and `npx tsc -p tsconfig.server.json` (the server, `api/`, and the `src/` files they import). Both must print nothing.
- **Imports in `api/` and `server/`** use explicit `.js` extensions; the server tsconfig fails without them.
- **Every server test file** starts with `// @vitest-environment node`. Days in tests come from local parts (`new Date(2026, 9, 14, 10, 0)`), which Vitest reads as Kathmandu time.
- **No tests in `api/`.** Every file there is deployed. Task 13 adds a test that enforces it.
- **No live data.** Nothing here runs `npm run dev`, which reads and writes the live Firestore database. Nothing calls Firebase, Vercel or `claude mcp`, except in Task 15, which is the controller's and needs the user's go-ahead.
- **Commit** through a message on stdin, so quotes in the message cannot break the shell:

  ```bash
  git add <files>
  git commit -q -F - <<'MSG'
  Subject line in the imperative

  Why, in a sentence or two.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  MSG
  ```

## File map

| File | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json` (modify) | New dependencies; the build also type-checks the server. |
| `tsconfig.json` (modify) | Drops `allowImportingTsExtensions`, which Vercel's function compile rejects. |
| `src/main.tsx` (modify) | `./App` instead of `./App.tsx`, the one import that needed it. |
| `src/utils.ts`, `src/today.ts`, `src/campaigns.ts`, `src/nav.ts`, `src/folderColors.ts` (modify) | `.js` on relative imports, so Node can load them from a function. |
| `tsconfig.server.json` (create) | NodeNext type-check of `api/` and `server/`. |
| `server/mcp/env.ts` | The Kathmandu time zone, `MCP_TOKEN_SECRET` parsing, the 503 answer. |
| `server/mcp/seal.ts` | Seal and unseal JWE blobs with a kind, an expiry and an audience. |
| `server/mcp/firebaseAuth.ts` | `signInWithPassword`, `exchangeRefreshToken` and the ID-token cache, over REST. |
| `server/mcp/firestore.ts` | Firestore REST client: get, list, create, and update with an update mask and atomic appends; value encoding. |
| `server/mcp/limi.ts` | Data layer mirroring `src/store.ts`: profile, clients, workspace, comments, ideas, the writes and system comments; name picking; Kathmandu dates; plain error messages. |
| `server/mcp/tools.ts` | The thirteen tools: zod schemas, descriptions, output shaping. |
| `server/mcp/signInPage.ts` | The sign-in and error pages. |
| `server/mcp/oauth.ts` | Metadata, registration, authorize (GET and POST) and token handlers. |
| `server/mcp/server.ts` | The `/mcp` endpoint: bearer check, session, tool registration. |
| `server/mcp/fakeGoogle.ts`, `server/mcp/testData.ts` | Test support: a fake of Firebase Auth, securetoken and Firestore REST with the rules applied; one small agency of seed data. |
| `server/mcp/*.test.ts` | Tests, one file per module, plus `layout.test.ts`. |
| `api/mcp.ts`, `api/oauth/{register,authorize,token}.ts`, `api/well-known/{oauth-protected-resource,oauth-authorization-server}.ts` | Thin Vercel adapters. |
| `vercel.json` (modify) | Rewrites for `/mcp`, `/oauth/*` and `/.well-known/oauth-*`, then the SPA catch-all, which no longer matches `api/`. |

---

### Task 1: Dependencies, configuration and the server environment

**Files:**
- Modify: `package.json`, `package-lock.json`, `tsconfig.json`, `src/main.tsx`, `src/utils.ts`, `src/today.ts`, `src/campaigns.ts`, `src/nav.ts`, `src/folderColors.ts`
- Create: `tsconfig.server.json`, `server/mcp/env.ts`, `server/mcp/env.test.ts`

- [ ] **Step 1: Install the packages**

Run:

```bash
npm install mcp-handler@2.3.0 @modelcontextprotocol/server@2.3.1 zod@4.6.7 jose@6.2.12
npm install -D @types/node@20.19.0
```

Expected: both finish without `ERESOLVE`. `package.json` gains `@modelcontextprotocol/server`, `jose`, `mcp-handler` and `zod` under `dependencies` and `@types/node` under `devDependencies`. `next` is not installed; it is an optional peer of `mcp-handler`.

- [ ] **Step 2: Type-check the server in the build**

In `package.json`, change the `build` script:

```json
    "build": "tsc && tsc -p tsconfig.server.json && vite build",
```

- [ ] **Step 3: Give the shared `src/` files Node-loadable imports**

Node loads these from a Vercel function, so every relative import in them needs `.js`. Vite, Vitest and `tsc` (bundler resolution) map `.js` to the `.ts` file. Make exactly these edits:

- `src/utils.ts`, line 1 (keep the byte-order mark at the start of the file): `from './types'` → `from './types.js'`.
- `src/today.ts`, line 1: `from './types'` → `from './types.js'`.
- `src/nav.ts`, line 1: `from './types'` → `from './types.js'`.
- `src/campaigns.ts`, lines 3 to 5:

  ```ts
  } from './types.js';
  import { awaitingReview } from './nav.js';
  import { DEFAULT_FOLDER_COLOR } from './folderColors.js';
  ```

- `src/folderColors.ts`, lines 2 and 3:

  ```ts
  import { FolderColor } from './types.js';
  import { contrastRatio } from './color.js';
  ```

- [ ] **Step 4: Remove `allowImportingTsExtensions`**

Vercel compiles functions with `noEmit` off, and TypeScript then rejects this option. It exists for one import.

- In `src/main.tsx`, line 3: `import App from './App.tsx'` → `import App from './App'`.
- In `tsconfig.json`, delete the line `"allowImportingTsExtensions": true,`.

- [ ] **Step 5: Create `tsconfig.server.json`**

NodeNext resolution makes `tsc` reject a relative import without `.js`, here and in every `src/` file the server reaches. `vite/client` types `import.meta.env` in `src/utils.ts`; `vitest/globals` types the test files.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node", "vite/client", "vitest/globals"],
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["api", "server"]
}
```

- [ ] **Step 6: Write the failing test**

Create `server/mcp/env.test.ts`:

```ts
// @vitest-environment node
import { keyFromSecret, notConfigured, readEnv } from './env.js';

const SECRET = Buffer.alloc(32, 7).toString('base64');

describe('readEnv', () => {
  it('reads the key and the Firebase settings', () => {
    const result = readEnv({
      MCP_TOKEN_SECRET: SECRET,
      VITE_FIREBASE_API_KEY: 'api-key',
      VITE_FIREBASE_PROJECT_ID: 'limi-test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.key).toHaveLength(32);
    expect(result.env.apiKey).toBe('api-key');
    expect(result.env.projectId).toBe('limi-test');
  });

  it('reports a missing secret', () => {
    const result = readEnv({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' });
    expect(result).toEqual({
      ok: false,
      message: 'The Limi connector is not switched on yet: MCP_TOKEN_SECRET is not set.',
    });
  });

  it('reports missing Firebase settings', () => {
    expect(readEnv({ MCP_TOKEN_SECRET: SECRET }).ok).toBe(false);
  });

  it('refuses a secret that is not 32 bytes', () => {
    const result = readEnv({
      MCP_TOKEN_SECRET: Buffer.alloc(16).toString('base64'),
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_PROJECT_ID: 'p',
    });
    expect(result).toEqual({ ok: false, message: 'MCP_TOKEN_SECRET must be 32 random bytes in base64.' });
  });
});

describe('keyFromSecret', () => {
  it('decodes base64 to 32 bytes', () => {
    expect(Array.from(keyFromSecret(SECRET).slice(0, 3))).toEqual([7, 7, 7]);
  });
});

describe('notConfigured', () => {
  it('is a plain 503', async () => {
    const res = notConfigured('Not yet.');
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Not yet.');
  });
});

describe('time zone', () => {
  it('is Kathmandu once the module has loaded', () => {
    expect(process.env.TZ).toBe('Asia/Kathmandu');
    // 00:00 in Kathmandu is 18:15 the day before in UTC.
    expect(new Date(2026, 9, 14).toISOString()).toBe('2026-10-13T18:15:00.000Z');
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

Run: `npx vitest run server/mcp/env.test.ts`
Expected: FAIL with `Failed to load url ./env.js`.

- [ ] **Step 8: Create `server/mcp/env.ts`**

```ts
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
```

- [ ] **Step 9: Run the test, the types and the suite**

Run: `npx vitest run server/mcp/env.test.ts`
Expected: PASS, 7 tests.

Run: `npx tsc --noEmit`, then `npx tsc -p tsconfig.server.json`
Expected: both print nothing.

Run: `npm test`
Expected: 606 tests pass.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.server.json src/main.tsx src/utils.ts src/today.ts src/campaigns.ts src/nav.ts src/folderColors.ts server/mcp/env.ts server/mcp/env.test.ts
git commit -q -F - <<'MSG'
Prepare the repo for the MCP server

Adds mcp-handler, the MCP SDK v2 server, zod and jose, a NodeNext
type-check for server code, and .js extensions on the src/ files the
server imports, which Node's ESM loader needs inside a Vercel function.
env.ts pins the Kathmandu time zone and reads MCP_TOKEN_SECRET.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 2: Sealed blobs

**Files:**
- Create: `server/mcp/seal.ts`, `server/mcp/seal.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/seal.test.ts`:

```ts
// @vitest-environment node
import { seal, unseal } from './seal.js';

const KEY = new Uint8Array(32).fill(7);
const OTHER_KEY = new Uint8Array(32).fill(8);
const T0 = Date.UTC(2026, 9, 14, 4, 15);

// Flips one character in the middle of the ciphertext segment. The last
// character is avoided: it can carry only padding bits.
function tamper(token: string): string {
  const parts = token.split('.');
  const c = parts[3];
  const i = Math.floor(c.length / 2);
  parts[3] = c.slice(0, i) + (c[i] === 'A' ? 'B' : 'A') + c.slice(i + 1);
  return parts.join('.');
}

describe('seal and unseal', () => {
  it('round-trips the payload', async () => {
    const token = await seal(KEY, 'access', { uid: 'u1', rt: 'refresh-1' }, { ttlSeconds: 60 });
    const claims = await unseal<{ uid: string; rt: string }>(KEY, 'access', token);
    expect(claims).toMatchObject({ uid: 'u1', rt: 'refresh-1' });
  });

  it('cannot be read without the key', async () => {
    const token = await seal(KEY, 'access', { rt: 'refresh-1' });
    expect(token).not.toContain('refresh-1');
    expect(Buffer.from(token.split('.')[3], 'base64url').toString()).not.toContain('refresh-1');
  });

  it('refuses an expired blob', async () => {
    const token = await seal(KEY, 'code', { uid: 'u1' }, { ttlSeconds: 300, now: T0 });
    expect(await unseal(KEY, 'code', token, { now: T0 + 299_000 })).not.toBeNull();
    expect(await unseal(KEY, 'code', token, { now: T0 + 301_000 })).toBeNull();
  });

  it('refuses a tampered blob', async () => {
    const token = await seal(KEY, 'access', { uid: 'u1' });
    expect(await unseal(KEY, 'access', tamper(token))).toBeNull();
  });

  it('refuses a blob sealed under another key', async () => {
    const token = await seal(OTHER_KEY, 'access', { uid: 'u1' });
    expect(await unseal(KEY, 'access', token)).toBeNull();
  });

  it('refuses a blob of another kind', async () => {
    const code = await seal(KEY, 'code', { uid: 'u1' });
    expect(await unseal(KEY, 'access', code)).toBeNull();
  });

  it('checks the audience when one is asked for', async () => {
    const token = await seal(KEY, 'access', { uid: 'u1' }, { audience: 'https://a.example/mcp' });
    expect(await unseal(KEY, 'access', token, { audience: 'https://a.example/mcp' })).not.toBeNull();
    expect(await unseal(KEY, 'access', token, { audience: 'https://b.example/mcp' })).toBeNull();
  });

  it('treats garbage and absence as invalid', async () => {
    expect(await unseal(KEY, 'access', 'not-a-token')).toBeNull();
    expect(await unseal(KEY, 'access', '')).toBeNull();
    expect(await unseal(KEY, 'access', undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/seal.test.ts`
Expected: FAIL with `Failed to load url ./seal.js`.

- [ ] **Step 3: Create `server/mcp/seal.ts`**

```ts
import { EncryptJWT, jwtDecrypt } from 'jose';

// There is no token database. Everything the server needs travels inside a
// sealed blob: a JWE encrypted with `dir` + `A256GCM` under MCP_TOKEN_SECRET,
// so the holder can neither read nor alter it. The kind is sealed in too, so
// a sign-in code can never be replayed as an access token, or the reverse.
export type SealKind = 'client' | 'code' | 'access' | 'refresh';

const ALG = 'dir';
const ENC = 'A256GCM';

export interface SealOptions {
  /** Lifetime in seconds. Omitted means the blob never expires (client ids). */
  ttlSeconds?: number;
  /** Binds the blob to one resource, e.g. https://host/mcp. */
  audience?: string;
  /** Milliseconds; for tests. */
  now?: number;
}

export async function seal(
  key: Uint8Array,
  kind: SealKind,
  payload: Record<string, unknown>,
  options: SealOptions = {}
): Promise<string> {
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const jwt = new EncryptJWT({ ...payload, knd: kind })
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setIssuedAt(now);
  if (options.ttlSeconds !== undefined) jwt.setExpirationTime(now + options.ttlSeconds);
  if (options.audience) jwt.setAudience(options.audience);
  return jwt.encrypt(key);
}

/**
 * The payload, or null when the blob is malformed, tampered with, sealed under
 * another key, expired, of another kind or for another audience. Callers never
 * need to tell those apart: each one means "sign in again".
 */
export async function unseal<T extends object>(
  key: Uint8Array,
  kind: SealKind,
  token: string | null | undefined,
  options: { audience?: string; now?: number } = {}
): Promise<(T & { exp?: number }) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, key, {
      keyManagementAlgorithms: [ALG],
      contentEncryptionAlgorithms: [ENC],
      ...(options.audience ? { audience: options.audience } : {}),
      ...(options.now !== undefined ? { currentDate: new Date(options.now) } : {}),
    });
    if (payload.knd !== kind) return null;
    return payload as unknown as T & { exp?: number };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests and the types**

Run: `npx vitest run server/mcp/seal.test.ts`
Expected: PASS, 8 tests.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/mcp/seal.ts server/mcp/seal.test.ts
git commit -q -F - <<'MSG'
Seal connector tokens as JWE under MCP_TOKEN_SECRET

There is no token database: client ids, sign-in codes and tokens are
encrypted blobs carrying a kind, an expiry and an audience.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 3: Firebase Auth over REST

**Files:**
- Create: `server/mcp/firebaseAuth.ts`, `server/mcp/firebaseAuth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/firebaseAuth.test.ts`:

```ts
// @vitest-environment node
import {
  createIdTokenCache, exchangeRefreshToken, FirebaseAuthError, signInWithPassword, type FetchLike,
} from './firebaseAuth.js';

interface Seen { url: string; init: RequestInit }

function fakeFetch(status: number, body: unknown) {
  const seen: Seen[] = [];
  const fetchFn: FetchLike = async (url, init = {}) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetchFn, seen };
}

const REFRESHED = { id_token: 'id-2', refresh_token: 'rt-1', expires_in: '3600', user_id: 'u1' };

describe('signInWithPassword', () => {
  it('posts the lower-cased email and returns the tokens', async () => {
    const { fetchFn, seen } = fakeFetch(200, {
      localId: 'u1', idToken: 'id-1', refreshToken: 'rt-1', expiresIn: '3600',
    });
    const result = await signInWithPassword('api-key', '  Sam@Shopit.TEST ', 'pw', fetchFn);
    expect(result).toEqual({ uid: 'u1', idToken: 'id-1', refreshToken: 'rt-1' });
    expect(seen[0].url).toBe(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=api-key'
    );
    expect(JSON.parse(seen[0].init.body as string)).toEqual({
      email: 'sam@shopit.test', password: 'pw', returnSecureToken: true,
    });
  });

  it('turns a bad password into the message the app shows', async () => {
    const { fetchFn } = fakeFetch(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
    await expect(signInWithPassword('k', 'a@b.c', 'wrong', fetchFn)).rejects.toMatchObject({
      code: 'INVALID_LOGIN_CREDENTIALS', message: 'Invalid email or password.',
    });
  });

  it('reads the code in front of a long throttling message', async () => {
    const { fetchFn } = fakeFetch(400, {
      error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled' },
    });
    await expect(signInWithPassword('k', 'a@b.c', 'x', fetchFn)).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS_TRY_LATER',
      message: 'Too many failed attempts. Try again later or reset your password.',
    });
  });

  it('reports an unreachable service as a sign-in error, not a crash', async () => {
    const fetchFn: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(signInWithPassword('k', 'a@b.c', 'x', fetchFn)).rejects.toBeInstanceOf(FirebaseAuthError);
  });
});

describe('exchangeRefreshToken', () => {
  it('posts a form and returns the ID token with its expiry', async () => {
    const { fetchFn, seen } = fakeFetch(200, REFRESHED);
    const result = await exchangeRefreshToken('api-key', 'rt-1', fetchFn, 1_000);
    expect(result).toEqual({ uid: 'u1', idToken: 'id-2', refreshToken: 'rt-1', expiresAt: 3_601_000 });
    expect(seen[0].url).toBe('https://securetoken.googleapis.com/v1/token?key=api-key');
    expect(seen[0].init.body).toBe('grant_type=refresh_token&refresh_token=rt-1');
  });

  it('fails on a revoked token with the sign-in-again message', async () => {
    const { fetchFn } = fakeFetch(400, { error: { message: 'TOKEN_EXPIRED' } });
    await expect(exchangeRefreshToken('k', 'rt-1', fetchFn)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED', message: 'Your Limi sign-in has expired. Sign in again.',
    });
  });
});

describe('createIdTokenCache', () => {
  it('reuses a token until five minutes before it expires', async () => {
    const { fetchFn, seen } = fakeFetch(200, REFRESHED);
    const idTokenFor = createIdTokenCache('k', fetchFn);
    await idTokenFor('rt-1', 0);
    await idTokenFor('rt-1', 54 * 60_000);
    expect(seen).toHaveLength(1);
    await idTokenFor('rt-1', 56 * 60_000);
    expect(seen).toHaveLength(2);
  });

  it('keeps tokens apart per refresh token', async () => {
    const { fetchFn, seen } = fakeFetch(200, REFRESHED);
    const idTokenFor = createIdTokenCache('k', fetchFn);
    await idTokenFor('rt-1', 0);
    await idTokenFor('rt-2', 0);
    expect(seen).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/firebaseAuth.test.ts`
Expected: FAIL with `Failed to load url ./firebaseAuth.js`.

- [ ] **Step 3: Create `server/mcp/firebaseAuth.ts`**

```ts
// Firebase Auth over plain REST. No firebase-admin, and no service account:
// the server only ever holds what the signed-in person's own sign-in returns.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class FirebaseAuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

const BAD_LOGIN = 'Invalid email or password.';

// The same wording the app's sign-in screen uses (signInErrorMessage).
const SIGN_IN_MESSAGES: Record<string, string> = {
  INVALID_LOGIN_CREDENTIALS: BAD_LOGIN,
  INVALID_PASSWORD: BAD_LOGIN,
  EMAIL_NOT_FOUND: BAD_LOGIN,
  INVALID_EMAIL: 'That email address is not valid.',
  MISSING_PASSWORD: 'Enter your password.',
  USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many failed attempts. Try again later or reset your password.',
};

export const SIGNED_OUT = 'Your Limi sign-in has expired. Sign in again.';

// Firebase puts the code first: "TOO_MANY_ATTEMPTS_TRY_LATER : Access to this
// account has been temporarily disabled…".
function errorCode(body: unknown): string {
  const message = (body as { error?: { message?: string } } | null)?.error?.message ?? '';
  return message.split(/[\s:]/)[0] || 'UNKNOWN';
}

async function post(fetchFn: FetchLike, url: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetchFn(url, { method: 'POST', ...init });
  } catch {
    throw new FirebaseAuthError('NETWORK', 'Could not reach the sign-in service. Try again.');
  }
  const body: unknown = await res.json().catch(() => null);
  return { res, body };
}

export interface SignInResult {
  uid: string;
  idToken: string;
  refreshToken: string;
}

export async function signInWithPassword(
  apiKey: string,
  email: string,
  password: string,
  fetchFn: FetchLike = fetch
): Promise<SignInResult> {
  const { res, body } = await post(
    fetchFn,
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      headers: { 'Content-Type': 'application/json' },
      // Lower-cased like the app's sign-in, so the same address always works.
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const code = errorCode(body);
    throw new FirebaseAuthError(code, SIGN_IN_MESSAGES[code] ?? 'Could not sign in.');
  }
  const ok = body as { localId: string; idToken: string; refreshToken: string };
  return { uid: ok.localId, idToken: ok.idToken, refreshToken: ok.refreshToken };
}

export interface IdToken {
  uid: string;
  idToken: string;
  /** Firebase may hand back a new refresh token; use it from then on. */
  refreshToken: string;
  /** Milliseconds. */
  expiresAt: number;
}

/**
 * Fails when the refresh token has been revoked — a password change, a
 * disabled account — which callers treat exactly like an expired sign-in.
 */
export async function exchangeRefreshToken(
  apiKey: string,
  refreshToken: string,
  fetchFn: FetchLike = fetch,
  now: number = Date.now()
): Promise<IdToken> {
  const { res, body } = await post(
    fetchFn,
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
    }
  );
  if (!res.ok) throw new FirebaseAuthError(errorCode(body), SIGNED_OUT);
  const ok = body as { id_token: string; refresh_token: string; expires_in: string; user_id: string };
  return {
    uid: ok.user_id,
    idToken: ok.id_token,
    refreshToken: ok.refresh_token || refreshToken,
    expiresAt: now + Number(ok.expires_in || 3600) * 1000,
  };
}

const EARLY = 5 * 60_000;

/**
 * ID tokens last an hour. A warm instance keeps each one until five minutes
 * before it expires, so a conversation's tool calls do not each pay for a
 * round trip to Google.
 */
export function createIdTokenCache(apiKey: string, fetchFn: FetchLike = fetch) {
  const cache = new Map<string, IdToken>();
  return async function idTokenFor(refreshToken: string, now: number = Date.now()): Promise<IdToken> {
    const hit = cache.get(refreshToken);
    if (hit && hit.expiresAt - EARLY > now) return hit;
    cache.delete(refreshToken);
    const fresh = await exchangeRefreshToken(apiKey, refreshToken, fetchFn, now);
    cache.set(refreshToken, fresh);
    return fresh;
  };
}
```

- [ ] **Step 4: Run the tests and the types**

Run: `npx vitest run server/mcp/firebaseAuth.test.ts`
Expected: PASS, 8 tests.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/mcp/firebaseAuth.ts server/mcp/firebaseAuth.test.ts
git commit -q -F - <<'MSG'
Sign in and refresh ID tokens with Firebase Auth REST

No admin SDK and no service account: the server only holds what the
person's own sign-in returns. ID tokens are cached per warm instance.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 4: A Firestore REST client

**Files:**
- Create: `server/mcp/firestore.ts`, `server/mcp/firestore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/firestore.test.ts`:

```ts
// @vitest-environment node
import {
  createFirestore, decodeDocument, decodeValue, encodeFields, encodeValue, FirestoreError, updateMaskFor,
} from './firestore.js';
import type { FetchLike } from './firebaseAuth.js';

const ROOT = 'https://firestore.googleapis.com/v1/projects/limi-test/databases/(default)/documents';

interface Seen { url: string; init: RequestInit }

function respond(...answers: { status?: number; body: unknown }[]) {
  const seen: Seen[] = [];
  const fetchFn: FetchLike = async (url, init = {}) => {
    seen.push({ url, init });
    const answer = answers[Math.min(seen.length - 1, answers.length - 1)];
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  };
  return { fs: createFirestore({ projectId: 'limi-test', idToken: 'id-1', fetch: fetchFn }), seen };
}

describe('value encoding', () => {
  it('encodes each type Limi stores', () => {
    expect(encodeValue('Momo')).toEqual({ stringValue: 'Momo' });
    expect(encodeValue(1791982686000)).toEqual({ integerValue: '1791982686000' });
    expect(encodeValue(2.5)).toEqual({ doubleValue: 2.5 });
    expect(encodeValue(true)).toEqual({ booleanValue: true });
    expect(encodeValue(null)).toEqual({ nullValue: null });
    expect(encodeValue(['instagram', 'tiktok'])).toEqual({
      arrayValue: { values: [{ stringValue: 'instagram' }, { stringValue: 'tiktok' }] },
    });
    expect(encodeValue({ link: 'a', at: 1 })).toEqual({
      mapValue: { fields: { link: { stringValue: 'a' }, at: { integerValue: '1' } } },
    });
  });

  it('drops undefined fields', () => {
    expect(encodeFields({ a: 'x', b: undefined })).toEqual({ a: { stringValue: 'x' } });
  });

  it('round-trips nested data', () => {
    const data = {
      title: 'Momo reel',
      createdAt: 100,
      platforms: ['instagram'],
      versions: [{ link: 'https://old', replacedAt: 5, mediaType: 'video' }],
      empty: [],
      nothing: null,
    };
    expect(decodeValue(encodeValue(data))).toEqual(data);
  });

  it('reads an empty array as []', () => {
    expect(decodeValue({ arrayValue: {} })).toEqual([]);
  });

  it('takes the id from the document name', () => {
    expect(
      decodeDocument({
        name: 'projects/p/databases/(default)/documents/clients/shopit',
        fields: { name: { stringValue: 'Shopit' } },
      })
    ).toEqual({ name: 'Shopit', id: 'shopit' });
  });
});

describe('updateMaskFor', () => {
  it('is exactly the fields that are set', () => {
    expect(updateMaskFor({ status: 'review', title: undefined, reviewNote: '' })).toEqual([
      'status',
      'reviewNote',
    ]);
  });
});

describe('createFirestore', () => {
  it('gets a document with the ID token', async () => {
    const { fs, seen } = respond({ body: { name: `x/clients/shopit`, fields: { name: { stringValue: 'Shopit' } } } });
    expect(await fs.get('clients/shopit')).toEqual({ name: 'Shopit', id: 'shopit' });
    expect(seen[0].url).toBe(`${ROOT}/clients/shopit`);
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe('Bearer id-1');
  });

  it('reads a missing document as null', async () => {
    const { fs } = respond({ status: 404, body: { error: { status: 'NOT_FOUND', message: 'nope' } } });
    expect(await fs.get('clients/gone')).toBeNull();
  });

  it('raises a refusal with its status', async () => {
    const { fs } = respond({
      status: 403,
      body: { error: { status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } },
    });
    const err = await fs.get('clients/everest').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirestoreError);
    expect(err).toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('follows list pages', async () => {
    const { fs, seen } = respond(
      { body: { documents: [{ name: 'x/a', fields: {} }], nextPageToken: 'next' } },
      { body: { documents: [{ name: 'x/b', fields: {} }] } }
    );
    expect((await fs.list('clients/shopit/content')).map((d) => d.id)).toEqual(['a', 'b']);
    expect(seen[0].url).toBe(`${ROOT}/clients/shopit/content?pageSize=300`);
    expect(seen[1].url).toBe(`${ROOT}/clients/shopit/content?pageSize=300&pageToken=next`);
  });

  it('lists an empty collection as []', async () => {
    const { fs } = respond({ body: {} });
    expect(await fs.list('clients/shopit/ideas')).toEqual([]);
  });

  it('creates a document under the given id', async () => {
    const { fs, seen } = respond({ body: {} });
    await fs.create('clients/shopit/ideas', 'i9', { title: 'Lights', businessId: undefined });
    expect(seen[0].url).toBe(`${ROOT}/clients/shopit/ideas?documentId=i9`);
    expect(seen[0].init.method).toBe('POST');
    expect(JSON.parse(seen[0].init.body as string)).toEqual({ fields: { title: { stringValue: 'Lights' } } });
  });

  it('updates only the changed fields, and appends atomically', async () => {
    const { fs, seen } = respond({ body: {} });
    await fs.update(
      'clients/shopit/content/momo',
      { driveLink: 'https://new', title: undefined },
      { versions: [{ link: 'https://old' }] }
    );
    expect(seen[0].url).toBe(`${ROOT}:commit`);
    expect(JSON.parse(seen[0].init.body as string)).toEqual({
      writes: [
        {
          update: {
            name: 'projects/limi-test/databases/(default)/documents/clients/shopit/content/momo',
            fields: { driveLink: { stringValue: 'https://new' } },
          },
          updateMask: { fieldPaths: ['driveLink'] },
          currentDocument: { exists: true },
          updateTransforms: [
            {
              fieldPath: 'versions',
              appendMissingElements: {
                values: [{ mapValue: { fields: { link: { stringValue: 'https://old' } } } }],
              },
            },
          ],
        },
      ],
    });
  });

  it('reports an unreachable database as a FirestoreError', async () => {
    const fs = createFirestore({
      projectId: 'p',
      idToken: 't',
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(fs.list('clients')).rejects.toMatchObject({ status: 0, code: 'UNAVAILABLE' });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/firestore.test.ts`
Expected: FAIL with `Failed to load url ./firestore.js`.

- [ ] **Step 3: Create `server/mcp/firestore.ts`**

Updates go through `:commit` rather than `PATCH`: the same update mask, plus `appendMissingElements`, which is what `arrayUnion` does in the app, so a new version is appended atomically.

```ts
import type { FetchLike } from './firebaseAuth.js';

// A small Firestore REST client. Every call carries the signed-in person's own
// ID token, so firestore.rules decide what it may read and write, exactly as
// they do for the app.

export type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

export interface FsDocument {
  /** projects/{p}/databases/(default)/documents/{path} */
  name: string;
  fields?: Record<string, FsValue>;
}

export function encodeValue(value: unknown): FsValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    // Timestamps and counts are integers; the JS SDK stores them the same way.
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.filter((v) => v !== undefined).map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }
  throw new Error(`Cannot store a ${typeof value} in Firestore.`);
}

/** Undefined fields are dropped, as Firestore rejects them outright. */
export function encodeFields(data: Record<string, unknown>): Record<string, FsValue> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, encodeValue(v)])
  );
}

export function decodeValue(value: FsValue): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return Date.parse(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
  // Types Limi never writes (references, geo points, bytes).
  return null;
}

export function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

/** The document's fields, plus `id` from its name — as the app reads `{ ...data(), id }`. */
export function decodeDocument(doc: FsDocument): Record<string, unknown> & { id: string } {
  return { ...decodeFields(doc.fields ?? {}), id: doc.name.split('/').pop() ?? '' };
}

/** The fields an update writes: exactly those it sets, so nothing else is touched. */
export function updateMaskFor(data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((k) => data[k] !== undefined);
}

export class FirestoreError extends Error {
  constructor(
    /** HTTP status: 403 when the rules refuse, 404 when the document is missing. */
    readonly status: number,
    /** Google's status name, e.g. PERMISSION_DENIED. */
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'FirestoreError';
  }
}

export interface FirestoreClient {
  /** null when the document does not exist. */
  get<T extends object>(path: string): Promise<(T & { id: string }) | null>;
  /** Every document in a collection, in no particular order. */
  list<T extends object>(collectionPath: string): Promise<(T & { id: string })[]>;
  /** Fails if a document with that id already exists. */
  create(collectionPath: string, id: string, data: Record<string, unknown>): Promise<void>;
  /**
   * Writes only the given fields of an existing document, and optionally
   * appends to array fields atomically (Firestore's arrayUnion).
   */
  update(path: string, data: Record<string, unknown>, append?: Record<string, unknown[]>): Promise<void>;
}

const HOST = 'https://firestore.googleapis.com/v1';

export function createFirestore({
  projectId,
  idToken,
  fetch: fetchFn = fetch,
}: {
  projectId: string;
  idToken: string;
  fetch?: FetchLike;
}): FirestoreClient {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const docUrl = (path: string) => `${HOST}/${root}/${path}`;

  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(url, {
        ...init,
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      });
    } catch {
      throw new FirestoreError(0, 'UNAVAILABLE', 'Could not reach the Limi database.');
    }
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = (body as { error?: { status?: string; message?: string } }).error ?? {};
      throw new FirestoreError(res.status, error.status ?? 'UNKNOWN', error.message ?? `Firestore answered ${res.status}.`);
    }
    return body as T;
  }

  return {
    async get<T extends object>(path: string) {
      try {
        return decodeDocument(await call<FsDocument>(docUrl(path))) as T & { id: string };
      } catch (err) {
        if (err instanceof FirestoreError && err.status === 404) return null;
        throw err;
      }
    },

    async list<T extends object>(collectionPath: string) {
      const out: (T & { id: string })[] = [];
      let pageToken = '';
      do {
        const query = new URLSearchParams({ pageSize: '300' });
        if (pageToken) query.set('pageToken', pageToken);
        const page = await call<{ documents?: FsDocument[]; nextPageToken?: string }>(
          `${docUrl(collectionPath)}?${query}`
        );
        out.push(...(page.documents ?? []).map((d) => decodeDocument(d) as T & { id: string }));
        pageToken = page.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },

    async create(collectionPath, id, data) {
      await call(`${docUrl(collectionPath)}?documentId=${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify({ fields: encodeFields(data) }),
      });
    },

    async update(path, data, append = {}) {
      const updateTransforms = Object.entries(append).map(([fieldPath, values]) => ({
        fieldPath,
        appendMissingElements: { values: values.map(encodeValue) },
      }));
      await call(`${HOST}/${root}:commit`, {
        method: 'POST',
        body: JSON.stringify({
          writes: [
            {
              update: { name: `${root}/${path}`, fields: encodeFields(data) },
              updateMask: { fieldPaths: updateMaskFor(data) },
              currentDocument: { exists: true },
              ...(updateTransforms.length > 0 ? { updateTransforms } : {}),
            },
          ],
        }),
      });
    },
  };
}
```

- [ ] **Step 4: Run the tests and the types**

Run: `npx vitest run server/mcp/firestore.test.ts`
Expected: PASS, 14 tests.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/mcp/firestore.ts server/mcp/firestore.test.ts
git commit -q -F - <<'MSG'
Add a Firestore REST client that runs as the signed-in person

Get, list, create, and update with an update mask and atomic array
appends. Every call carries the person's ID token, so firestore.rules
decide what it may do.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 5: The data layer: reads

**Files:**
- Create: `server/mcp/fakeGoogle.ts`, `server/mcp/testData.ts`, `server/mcp/limi.ts`, `server/mcp/limi.test.ts`

- [ ] **Step 1: Create the fake Google APIs**

`limiRules` is `firestore.rules` reduced to the calls the server makes. It refuses a client login a listing of `clients`, any client it is not assigned, and every write except comments, ideas and the two review fields.

Create `server/mcp/fakeGoogle.ts`:

```ts
// Test support only: an in-memory stand-in for the three Google APIs the
// server calls — Firebase Auth sign-in, the securetoken exchange and Firestore
// REST. Nothing in the tests touches live Firebase.
import { decodeFields, decodeValue, encodeFields, type FsValue } from './firestore.js';
import type { FetchLike } from './firebaseAuth.js';

export type FakeOp = 'get' | 'list' | 'create' | 'update';

export interface FakeCall {
  op: FakeOp;
  /** Document path for get/create/update; collection path for list. */
  path: string;
  /** The update mask, for update. */
  mask?: string[];
}

export type ReadDoc = (path: string) => Record<string, unknown> | undefined;

export interface FakeGoogleOptions {
  projectId?: string;
  docs?: Record<string, Record<string, unknown>>;
  accounts?: { email: string; password: string; uid: string }[];
  /** Answer 403 when this returns true, as firestore.rules would. */
  deny?: (call: FakeCall, uid: string, read: ReadDoc) => boolean;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const denied = () =>
  json(403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } });

function parseBody(body: RequestInit['body']): Record<string, unknown> {
  if (typeof body !== 'string') return {};
  return body.startsWith('{') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
}

export function fakeGoogle(options: FakeGoogleOptions = {}) {
  const projectId = options.projectId ?? 'limi-test';
  const docs = new Map<string, Record<string, unknown>>(
    Object.entries(options.docs ?? {}).map(([path, data]) => [path, structuredClone(data)])
  );
  const revoked = new Set<string>();
  /** Every Firestore call that reached the fake, in order, refused ones included. */
  const calls: FakeCall[] = [];
  const read: ReadDoc = (path) => docs.get(path);
  const prefix = `/v1/projects/${projectId}/databases/(default)/documents`;

  function firestore(url: URL, method: string, init: RequestInit): Response {
    const auth = new Headers(init.headers).get('Authorization') ?? '';
    const uid = auth.startsWith('Bearer id-') ? auth.slice('Bearer id-'.length) : '';
    if (!uid || revoked.has(uid)) {
      return json(401, { error: { status: 'UNAUTHENTICATED', message: 'Invalid token' } });
    }
    const rest = decodeURIComponent(url.pathname.slice(prefix.length));
    const body = parseBody(init.body);

    let call: FakeCall;
    if (rest === ':commit') {
      const write = (body.writes as {
        update: { name: string; fields?: Record<string, FsValue> };
        updateMask: { fieldPaths: string[] };
        updateTransforms?: { fieldPath: string; appendMissingElements: { values: FsValue[] } }[];
      }[])[0];
      const path = write.update.name.slice(write.update.name.indexOf('/documents/') + '/documents/'.length);
      call = { op: 'update', path, mask: write.updateMask.fieldPaths };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      const current = docs.get(path);
      if (!current) return json(404, { error: { status: 'NOT_FOUND', message: `No document to update: ${path}` } });
      const fields = decodeFields(write.update.fields ?? {});
      for (const key of write.updateMask.fieldPaths) {
        if (key in fields) current[key] = fields[key];
        else delete current[key];
      }
      for (const t of write.updateTransforms ?? []) {
        const list = Array.isArray(current[t.fieldPath]) ? (current[t.fieldPath] as unknown[]) : [];
        for (const v of t.appendMissingElements.values.map(decodeValue)) {
          if (!list.some((x) => JSON.stringify(x) === JSON.stringify(v))) list.push(v);
        }
        current[t.fieldPath] = list;
      }
      return json(200, { writeResults: [{}] });
    }

    const path = rest.replace(/^\//, '');
    const depth = path.split('/').length;
    if (method === 'GET' && depth % 2 === 0) {
      call = { op: 'get', path };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      const data = docs.get(path);
      if (!data) return json(404, { error: { status: 'NOT_FOUND', message: `${path} not found` } });
      return json(200, { name: `projects/${projectId}/databases/(default)/documents/${path}`, fields: encodeFields(data) });
    }
    if (method === 'GET') {
      call = { op: 'list', path };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      const documents = [...docs.entries()]
        .filter(([p]) => p.startsWith(`${path}/`) && p.split('/').length === depth + 1)
        .map(([p, data]) => ({
          name: `projects/${projectId}/databases/(default)/documents/${p}`,
          fields: encodeFields(data),
        }));
      return json(200, documents.length > 0 ? { documents } : {});
    }
    if (method === 'POST') {
      const docPath = `${path}/${url.searchParams.get('documentId')}`;
      call = { op: 'create', path: docPath };
      calls.push(call);
      if (options.deny?.(call, uid, read)) return denied();
      if (docs.has(docPath)) return json(409, { error: { status: 'ALREADY_EXISTS', message: 'exists' } });
      docs.set(docPath, decodeFields((body.fields ?? {}) as Record<string, FsValue>));
      return json(200, { name: docPath });
    }
    return json(400, { error: { status: 'INVALID_ARGUMENT', message: `${method} ${path}` } });
  }

  const fetchFn: FetchLike = async (input, init = {}) => {
    const url = new URL(input);
    const method = (init.method ?? 'GET').toUpperCase();
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      const { email, password } = parseBody(init.body) as { email: string; password: string };
      const account = options.accounts?.find((a) => a.email === email && a.password === password);
      if (!account) return json(400, { error: { message: 'INVALID_LOGIN_CREDENTIALS' } });
      return json(200, {
        localId: account.uid, idToken: `id-${account.uid}`, refreshToken: `rt-${account.uid}`, expiresIn: '3600',
      });
    }
    if (url.hostname === 'securetoken.googleapis.com') {
      const token = String(parseBody(init.body).refresh_token ?? '');
      const uid = token.startsWith('rt-') ? token.slice(3) : '';
      if (!uid || revoked.has(uid)) return json(400, { error: { message: 'TOKEN_EXPIRED' } });
      return json(200, { id_token: `id-${uid}`, refresh_token: token, expires_in: '3600', user_id: uid });
    }
    if (url.hostname === 'firestore.googleapis.com' && url.pathname.startsWith(prefix)) {
      return firestore(url, method, init);
    }
    throw new TypeError(`fakeGoogle: unexpected request ${method} ${input}`);
  };

  return {
    projectId,
    fetch: fetchFn,
    calls,
    doc: read,
    /** Every document path under a prefix. */
    paths: (under: string) => [...docs.keys()].filter((p) => p.startsWith(under)),
    /** What changing a password does: every refresh token for that account stops working. */
    revoke: (uid: string) => revoked.add(uid),
  };
}

const REVIEW_FIELDS = ['clientReview', 'reviewNote'];

/** firestore.rules, reduced to what the server's calls exercise. */
export function limiRules(call: FakeCall, uid: string, read: ReadDoc): boolean {
  const seg = call.path.split('/');
  const profile = read(`users/${uid}`) as { role?: string; assignedClientIds?: string[] } | undefined;
  if (seg[0] === 'users') {
    if (call.op === 'get' && seg[1] === uid) return false;
    return profile?.role !== 'admin';
  }
  if (!profile || seg[0] !== 'clients') return true;
  const team = profile.role === 'admin' || profile.role === 'social-media-manager';
  if (team) return false;
  // Rules are not filters: listing every client is refused to a client.
  if (seg.length === 1) return true;
  if (!(profile.assignedClientIds ?? []).includes(seg[1])) return true;
  if (call.op === 'get' || call.op === 'list') return false;
  if (call.op === 'create') {
    const comment = seg.length === 6 && (seg[2] === 'content' || seg[2] === 'ideas') && seg[4] === 'comments';
    const idea = seg.length === 4 && seg[2] === 'ideas';
    return !(comment || idea);
  }
  // update: a client may record a review decision and nothing else.
  return !(seg.length === 4 && seg[2] === 'content' && (call.mask ?? []).every((f) => REVIEW_FIELDS.includes(f)));
}
```

- [ ] **Step 2: Create the seed data**

`NOW` is Wednesday 14 October 2026, 10:00 in Kathmandu. Dashain recap is four days late; the Momo reel goes out on the 16th; the Draft carousel is still in Editing; Offer post was declined. `cli1` is a client assigned to Shopit and to a client that no longer exists; `ghost` signs in to Firebase but has no Limi profile.

Create `server/mcp/testData.ts`:

```ts
// Test support only: one small agency, built from Kathmandu local dates.
import './env.js';
import { createFirestore } from './firestore.js';
import { fakeGoogle, limiRules } from './fakeGoogle.js';
import { getProfile, type Session } from './limi.js';

/** Wednesday 14 October 2026, 10:00 in Kathmandu. */
export const NOW = new Date(2026, 9, 14, 10, 0).getTime();

export const at = (month: number, day: number, hour = 0, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).getTime();

export const DRIVE_LINK = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view';

export function seedDocs(): Record<string, Record<string, unknown>> {
  return {
    'users/admin1': {
      name: 'Asha Admin', email: 'asha@limi.test', role: 'admin', assignedClientIds: [], createdAt: 1,
    },
    'users/cli1': {
      name: 'Sam Shopit', email: 'sam@shopit.test', role: 'client', assignedClientIds: ['shopit', 'gone'], createdAt: 2,
    },
    'clients/shopit': {
      name: 'Shopit', about: 'Online store', color: 'red', createdAt: 10,
      // A legacy content array the migration left behind. Never surfaced.
      content: [{ id: 'legacy', title: 'Old' }],
    },
    'clients/everest': { name: 'Everest IT', about: '', color: 'blue', createdAt: 20 },
    'clients/shopit/businesses/main': { name: 'Shopit', color: 'red', about: '', createdAt: 10 },
    'clients/shopit/businesses/nepal': { name: 'Shopit Nepal', color: 'green', about: '', createdAt: 11 },
    'clients/everest/businesses/main': { name: 'Everest IT', color: 'blue', about: '', createdAt: 20 },
    'clients/shopit/campaigns/tihar': {
      businessId: 'main', name: 'Tihar 2026', brief: 'Internal: push the gift boxes', status: 'live',
      startDate: '2026-10-20', endDate: '2026-11-05', color: 'orange',
      deliverables: [{ id: 'd1', label: '3 Reels', mediaType: 'video', target: 3 }], createdAt: 30,
    },
    'clients/shopit/content/momo': {
      id: 'momo', title: 'Momo reel', driveLink: DRIVE_LINK, driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      mediaType: 'video', caption: 'Steaming momo, straight to you', hashtags: '#momo', platforms: ['instagram'],
      notes: 'Use the v2 music', status: 'review', createdAt: 100, scheduledAt: at(10, 16, 15),
      uploadedByEmail: 'asha@limi.test', clientReview: 'pending', reviewNote: '', businessId: 'main',
      campaignId: 'tihar', deliverableId: 'd1',
    },
    'clients/shopit/content/dashain': {
      id: 'dashain', title: 'Dashain recap', driveLink: 'https://youtu.be/abcdefghijk', driveFileId: '',
      mediaType: 'video', caption: '', hashtags: '', platforms: [], notes: '', status: 'to-post', createdAt: 101,
      scheduledAt: at(10, 10, 9), uploadedByEmail: 'asha@limi.test', clientReview: 'approved', reviewNote: '',
      businessId: 'main',
    },
    'clients/shopit/content/draft': {
      id: 'draft', title: 'Draft carousel', driveLink: '', driveFileId: '', mediaType: 'graphic', caption: '',
      hashtags: '', platforms: [], notes: '', status: 'editing', createdAt: 102, scheduledAt: 0,
      uploadedByEmail: 'asha@limi.test', clientReview: 'pending', reviewNote: '', businessId: 'main',
    },
    'clients/shopit/content/offer': {
      id: 'offer', title: 'Offer post', driveLink: 'https://example.com/offer.png', driveFileId: '',
      mediaType: 'graphic', caption: 'Ten percent off', hashtags: '', platforms: ['facebook'], notes: '',
      status: 'review', createdAt: 103, scheduledAt: 0, uploadedByEmail: 'asha@limi.test',
      clientReview: 'declined', reviewNote: 'Lower the music', businessId: 'nepal',
    },
    'clients/everest/content/laptop': {
      id: 'laptop', title: 'Laptop sale', driveLink: '', driveFileId: '', mediaType: 'video', caption: '',
      hashtags: '', platforms: [], notes: '', status: 'posted', createdAt: 104, scheduledAt: at(10, 1, 10),
      uploadedByEmail: 'asha@limi.test', clientReview: 'approved', reviewNote: '', businessId: 'main',
    },
    'clients/shopit/content/momo/comments/c1': {
      id: 'c1', kind: 'user', body: 'Looks good', authorEmail: 'sam@shopit.test', authorName: 'Sam Shopit',
      createdAt: 200, atSeconds: 12,
    },
    'clients/shopit/content/momo/comments/c0': {
      id: 'c0', kind: 'system', body: 'moved this to Review', authorEmail: 'asha@limi.test',
      authorName: 'Asha Admin', createdAt: 150,
    },
    'clients/shopit/ideas/i1': {
      id: 'i1', title: 'Tihar lights', description: 'Diyas at dusk', links: [], status: 'new',
      createdByEmail: 'sam@shopit.test', createdByName: 'Sam Shopit', createdAt: 300,
    },
    'clients/shopit/ideas/i2': {
      id: 'i2', title: 'Staff picks', description: '', links: [], status: 'declined',
      createdByEmail: 'asha@limi.test', createdByName: 'Asha Admin', createdAt: 301, businessId: 'nepal',
    },
  };
}

export const ACCOUNTS = [
  { email: 'asha@limi.test', password: 'admin-pw', uid: 'admin1' },
  { email: 'sam@shopit.test', password: 'client-pw', uid: 'cli1' },
  { email: 'nobody@limi.test', password: 'nobody-pw', uid: 'ghost' },
];

export function limiGoogle() {
  return fakeGoogle({ docs: seedDocs(), accounts: ACCOUNTS, deny: limiRules });
}

/** A session as the MCP endpoint would build it for that uid. */
export async function sessionAs(google: ReturnType<typeof fakeGoogle>, uid: string): Promise<Session> {
  const fs = createFirestore({ projectId: google.projectId, idToken: `id-${uid}`, fetch: google.fetch });
  const profile = await getProfile(fs, uid);
  if (!profile) throw new Error(`no profile for ${uid}`);
  return { fs, profile, now: () => NOW };
}
```

- [ ] **Step 3: Write the failing tests**

Create `server/mcp/limi.test.ts`:

```ts
// @vitest-environment node
import { FirestoreError } from './firestore.js';
import {
  findContent, getProfile, kathmanduIso, kathmanduText, LimiError, listClients, loadComments, loadIdeas,
  loadWorkspace, parseWhen, pick, plainMessage,
} from './limi.js';
import { at, limiGoogle, sessionAs } from './testData.js';

describe('getProfile', () => {
  it('reads the profile that grants a role', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    expect(session.profile).toMatchObject({ id: 'cli1', role: 'client', assignedClientIds: ['shopit', 'gone'] });
  });

  it('is null for an account with no profile', async () => {
    const google = limiGoogle();
    const { fs } = await sessionAs(google, 'admin1');
    expect(await getProfile(fs, 'ghost')).toBeNull();
  });
});

describe('listClients', () => {
  it('lists every client for the team, oldest first', async () => {
    const session = await sessionAs(limiGoogle(), 'admin1');
    expect((await listClients(session)).map((c) => c.name)).toEqual(['Shopit', 'Everest IT']);
  });

  it('reads only the assigned clients, by id, for a client login', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    google.calls.length = 0;
    const clients = await listClients(session);
    expect(clients.map((c) => c.id)).toEqual(['shopit']);
    // No attempt to list the collection, which the rules refuse to a client.
    expect(google.calls).toEqual([
      { op: 'get', path: 'clients/shopit' },
      { op: 'get', path: 'clients/gone' },
    ]);
  });

  it('never surfaces the legacy content array', async () => {
    const session = await sessionAs(limiGoogle(), 'admin1');
    const [shopit] = await listClients(session);
    expect(shopit).not.toHaveProperty('content');
  });
});

describe('loadWorkspace', () => {
  it('loads content, businesses and campaigns per client', async () => {
    const session = await sessionAs(limiGoogle(), 'admin1');
    const [shopit, everest] = await loadWorkspace(session);
    expect(shopit.content.map((i) => i.id)).toEqual(['momo', 'dashain', 'draft', 'offer']);
    expect(shopit.businesses.map((b) => b.id)).toEqual(['main', 'nepal']);
    expect(shopit.campaigns.map((c) => c.name)).toEqual(['Tihar 2026']);
    expect(everest.content.map((i) => i.id)).toEqual(['laptop']);
  });

  it('hides work still in Editing from a client', async () => {
    const session = await sessionAs(limiGoogle(), 'cli1');
    const workspace = await loadWorkspace(session);
    expect(workspace.map((c) => c.id)).toEqual(['shopit']);
    expect(workspace[0].content.map((i) => i.id)).toEqual(['momo', 'dashain', 'offer']);
  });
});

describe('comments and ideas', () => {
  it('reads a post thread oldest first', async () => {
    const session = await sessionAs(limiGoogle(), 'cli1');
    expect((await loadComments(session, 'shopit', 'momo')).map((c) => c.id)).toEqual(['c0', 'c1']);
  });

  it('reads ideas newest first', async () => {
    const session = await sessionAs(limiGoogle(), 'cli1');
    expect((await loadIdeas(session, 'shopit')).map((i) => i.id)).toEqual(['i2', 'i1']);
  });
});

describe('findContent', () => {
  it('finds a post across clients, or says it cannot', async () => {
    const workspace = await loadWorkspace(await sessionAs(limiGoogle(), 'admin1'));
    expect(findContent(workspace, 'laptop').client.id).toBe('everest');
    expect(() => findContent(workspace, 'nope')).toThrow("No such post (or you can't see it).");
  });
});

describe('pick', () => {
  const clients = [
    { id: 'shopit', name: 'Shopit' },
    { id: 'shopit-nepal', name: 'Shopit Nepal' },
    { id: 'everest', name: 'Everest IT' },
  ];

  it('prefers an exact id or name', () => {
    expect(pick(clients, 'shopit', 'client').id).toBe('shopit');
    expect(pick(clients, 'everest it', 'client').id).toBe('everest');
  });

  it('accepts a single partial match', () => {
    expect(pick(clients, 'ever', 'client').id).toBe('everest');
  });

  it('asks back when the name is ambiguous or unknown', () => {
    expect(() => pick(clients, 'shop', 'client')).toThrow(
      'Several clients match "shop": Shopit, Shopit Nepal. Which one?'
    );
    expect(() => pick(clients, 'Momo', 'client')).toThrow(
      'No client matches "Momo". The clients you can see: Shopit, Shopit Nepal, Everest IT.'
    );
  });
});

describe('dates', () => {
  it('reads a day or a day and time as Kathmandu local time', () => {
    expect(parseWhen('2026-10-20')).toBe(at(10, 20));
    expect(parseWhen('2026-10-20 15:30')).toBe(at(10, 20, 15, 30));
    expect(parseWhen('2026-10-20T09:05')).toBe(at(10, 20, 9, 5));
  });

  it('refuses anything else', () => {
    expect(() => parseWhen('next Tuesday')).toThrow(LimiError);
    expect(() => parseWhen('2026-02-30')).toThrow(LimiError);
    expect(() => parseWhen('2026-10-20 25:00')).toThrow(LimiError);
  });

  it('writes a time both ways', () => {
    expect(kathmanduIso(at(10, 16, 15))).toBe('2026-10-16T15:00+05:45');
    expect(kathmanduText(at(10, 16, 15))).toBe('Fri 16 Oct 2026, 3:00 PM');
    expect(kathmanduText(at(10, 16, 0, 5))).toBe('Fri 16 Oct 2026, 12:05 AM');
  });
});

describe('plainMessage', () => {
  it('turns a rules refusal into the plain sentence', () => {
    expect(plainMessage(new FirestoreError(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'))).toBe(
      "Your Limi role can't do that."
    );
  });

  it('turns a missing document into the plain sentence', () => {
    expect(plainMessage(new FirestoreError(404, 'NOT_FOUND', 'x'))).toBe("No such post (or you can't see it).");
  });

  it('never shows an internal error', () => {
    expect(plainMessage(new TypeError('cannot read properties of undefined'))).toBe(
      'Something went wrong in Limi. Try again in a moment.'
    );
  });

  it('a refused read from Firestore reaches the person as the plain sentence', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    const err = await session.fs.list('clients/everest/content').catch((e: unknown) => e);
    expect(plainMessage(err)).toBe("Your Limi role can't do that.");
  });
});
```

- [ ] **Step 4: Run them and watch them fail**

Run: `npx vitest run server/mcp/limi.test.ts`
Expected: FAIL with `Failed to load url ./limi.js` (imported by both the test and `testData.ts`).

- [ ] **Step 5: Create `server/mcp/limi.ts` with the reads**

```ts
import './env.js';
import type {
  AppUser, Business, Campaign, Client, Comment, ContentItem, Idea,
} from '../../src/types.js';
import { firstBusinessFirst } from '../../src/campaigns.js';
import { todaySources } from '../../src/today.js';
import { FirestoreError, type FirestoreClient } from './firestore.js';

// The data layer, mirroring src/store.ts over Firestore REST. Every read and
// write runs as the signed-in person, so firestore.rules bound it exactly as
// they bound the app.

export interface Session {
  fs: FirestoreClient;
  profile: AppUser;
  now: () => number;
}

/** A message meant for the person, shown as it is. */
export class LimiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimiError';
  }
}

export const ROLE_REFUSED = "Your Limi role can't do that.";
export const NO_SUCH_POST = "No such post (or you can't see it).";

/** Any failure as one plain sentence — never a stack trace. */
export function plainMessage(err: unknown): string {
  if (err instanceof LimiError) return err.message;
  if (err instanceof FirestoreError) {
    if (err.status === 403) return ROLE_REFUSED;
    if (err.status === 404) return NO_SUCH_POST;
    if (err.status === 401) return 'Your Limi sign-in has expired. Sign in again.';
    return 'The Limi database could not answer just now. Try again in a moment.';
  }
  return 'Something went wrong in Limi. Try again in a moment.';
}

export function actorOf(session: Session) {
  return { email: session.profile.email, name: session.profile.name || 'Someone' };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** null when the account has no profile, which means it has no access at all. */
export async function getProfile(fs: FirestoreClient, uid: string): Promise<AppUser | null> {
  try {
    const doc = await fs.get<Omit<AppUser, 'id'>>(`users/${uid}`);
    if (!doc) return null;
    return { ...doc, id: uid, assignedClientIds: doc.assignedClientIds ?? [] };
  } catch (err) {
    if (err instanceof FirestoreError && err.status === 403) return null;
    throw err;
  }
}

export type ClientInfo = Omit<Client, 'content' | 'businesses'>;

const byCreated = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

// The legacy `content` array some client documents still carry is left out,
// as the app leaves it out.
function toClientInfo(d: Record<string, unknown> & { id: string }): ClientInfo {
  return {
    id: d.id,
    name: String(d.name ?? ''),
    about: String(d.about ?? ''),
    createdAt: Number(d.createdAt ?? 0),
    ...(d.imageUrl ? { imageUrl: String(d.imageUrl) } : {}),
    ...(d.color ? { color: d.color as Client['color'] } : {}),
  };
}

/** The clients this login can see, oldest first. */
export async function listClients(session: Session): Promise<ClientInfo[]> {
  const { fs, profile } = session;
  let docs: (Record<string, unknown> & { id: string })[];
  if (profile.role === 'client') {
    // Rules are not filters: listing the collection is refused outright to a
    // client, so each assigned client is read by id — as useClients does.
    const found = await Promise.all(
      profile.assignedClientIds.map((id) =>
        fs.get(`clients/${id}`).catch((err: unknown) => {
          if (err instanceof FirestoreError && err.status === 403) return null;
          throw err;
        })
      )
    );
    docs = found.filter((d): d is Record<string, unknown> & { id: string } => d !== null);
  } else {
    docs = await fs.list('clients');
  }
  return docs.map(toClientInfo).sort(byCreated);
}

/** A client with its content, businesses (first business first) and campaigns. */
export type ClientData = Client & { campaigns: Campaign[] };

/**
 * Everything the tools read, for every visible client. A client login never
 * sees work still in Editing, as in the app (todaySources).
 */
export async function loadWorkspace(session: Session): Promise<ClientData[]> {
  const { fs, profile } = session;
  const infos = await listClients(session);
  const loaded = await Promise.all(
    infos.map(async (info) => {
      const [content, businesses, campaigns] = await Promise.all([
        fs.list<Omit<ContentItem, 'id'>>(`clients/${info.id}/content`),
        fs.list<Omit<Business, 'id'>>(`clients/${info.id}/businesses`),
        fs.list<Omit<Campaign, 'id'>>(`clients/${info.id}/campaigns`),
      ]);
      return {
        client: { ...info, content: content.sort(byCreated), businesses: firstBusinessFirst(businesses.sort(byCreated)) },
        campaigns: campaigns.sort(byCreated),
      };
    })
  );
  const visible = todaySources(loaded.map((l) => l.client), profile);
  return visible.map((client) => ({
    ...client,
    campaigns: loaded.find((l) => l.client.id === client.id)?.campaigns ?? [],
  }));
}

export async function loadComments(session: Session, clientId: string, contentId: string): Promise<Comment[]> {
  const comments = await session.fs.list<Omit<Comment, 'id'>>(`clients/${clientId}/content/${contentId}/comments`);
  return comments.sort(byCreated);
}

/** Newest first, as the Ideas tab lists them. */
export async function loadIdeas(session: Session, clientId: string): Promise<Idea[]> {
  const ideas = await session.fs.list<Omit<Idea, 'id'>>(`clients/${clientId}/ideas`);
  return ideas.sort((a, b) => b.createdAt - a.createdAt);
}

export function findContent(clients: ClientData[], contentId: string): { client: ClientData; item: ContentItem } {
  for (const client of clients) {
    const item = client.content.find((i) => i.id === contentId.trim());
    if (item) return { client, item };
  }
  throw new LimiError(NO_SUCH_POST);
}

// ─── Picking by name ─────────────────────────────────────────────────────────

export interface Named {
  id: string;
  name: string;
}

/**
 * The one item matching an id or a name. An exact id or name wins; otherwise a
 * single partial name match. None, or several, is a question back to Claude.
 */
export function pick<T extends Named>(items: T[], query: string, what: string, label = (i: T) => i.name): T {
  const q = query.trim().toLowerCase();
  const exact = items.filter((i) => i.id === query.trim() || i.name.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const candidates = exact.length > 1 ? exact : items.filter((i) => i.name.toLowerCase().includes(q));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    const known = items.map(label).join(', ') || 'none';
    throw new LimiError(`No ${what} matches "${query}". The ${what}s you can see: ${known}.`);
  }
  throw new LimiError(`Several ${what}s match "${query}": ${candidates.map(label).join(', ')}. Which one?`);
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-16T15:00+05:45": ISO 8601 with Kathmandu's offset. */
export function kathmanduIso(ms: number): string {
  const d = new Date(ms);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** "Fri 16 Oct 2026, 3:00 PM". Built from parts, so no ICU spacing quirks. */
export function kathmanduText(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/**
 * "2026-10-20" or "2026-10-20 15:30" (a T works too), read as Kathmandu local
 * time. A day alone means midnight, as the app's date field does.
 */
export function parseWhen(input: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(input.trim());
  const fail = () =>
    new LimiError(`"${input}" is not a date Limi understands. Use 2026-10-20 or 2026-10-20 15:30 (Kathmandu time).`);
  if (!m) throw fail();
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0'].map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d || h > 23 || mi > 59) throw fail();
  return date.getTime();
}
```

- [ ] **Step 6: Run the tests and the types**

Run: `npx vitest run server/mcp/limi.test.ts`
Expected: PASS, 20 tests, including "reads only the assigned clients, by id, for a client login" and "a refused read from Firestore reaches the person as the plain sentence".

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add server/mcp/fakeGoogle.ts server/mcp/testData.ts server/mcp/limi.ts server/mcp/limi.test.ts
git commit -q -F - <<'MSG'
Read Limi over REST the way the app does

A client login reads its assigned clients one by one, as useClients
does, and never sees work in Editing. Rules refusals become the plain
sentence "Your Limi role can't do that." Tests run against a fake of
Google's APIs with the security rules applied.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 6: The data layer: writes

**Files:**
- Modify: `server/mcp/limi.ts`
- Create: `server/mcp/limiWrites.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/limiWrites.test.ts`:

```ts
// @vitest-environment node
import {
  addComment, addIdea, createContent, findContent, loadWorkspace, mediaTypeFor, moveContent, reviewContent,
  stageLabel, updateContent,
} from './limi.js';
import { at, DRIVE_LINK, limiGoogle, NOW, sessionAs } from './testData.js';

async function admin() {
  const google = limiGoogle();
  const session = await sessionAs(google, 'admin1');
  google.calls.length = 0;
  return { google, session };
}

const commentsOf = (google: ReturnType<typeof limiGoogle>, contentPath: string) =>
  google
    .paths(`${contentPath}/comments/`)
    .map((p) => google.doc(p)!)
    .filter((c) => c.createdAt === NOW);

describe('createContent', () => {
  it('writes the document addContent would', async () => {
    const { google, session } = await admin();
    const item = await createContent(session, 'shopit', {
      title: 'Tihar teaser', driveLink: DRIVE_LINK, mediaType: 'video', status: 'editing',
      scheduledAt: at(10, 20, 18), businessId: 'main', campaignId: 'tihar', platforms: ['instagram'],
    });
    expect(google.doc(`clients/shopit/content/${item.id}`)).toEqual({
      id: item.id, title: 'Tihar teaser', driveLink: DRIVE_LINK, driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      mediaType: 'video', caption: '', hashtags: '', platforms: ['instagram'], notes: '', status: 'editing',
      createdAt: NOW, scheduledAt: at(10, 20, 18), uploadedByEmail: 'asha@limi.test', clientReview: 'pending',
      reviewNote: '', businessId: 'main', campaignId: 'tihar',
    });
  });

  it('stores no Drive file id for other links', async () => {
    const { google, session } = await admin();
    const item = await createContent(session, 'shopit', {
      title: 'Poster', driveLink: 'https://example.com/poster.png', mediaType: 'graphic', status: 'editing',
      businessId: 'main',
    });
    expect(google.doc(`clients/shopit/content/${item.id}`)).toMatchObject({ driveFileId: '', scheduledAt: 0 });
  });
});

describe('mediaTypeFor', () => {
  it('reads an image link as a graphic and anything else as a video', () => {
    expect(mediaTypeFor('https://example.com/a.jpg')).toBe('graphic');
    expect(mediaTypeFor(DRIVE_LINK)).toBe('video');
  });
});

describe('updateContent', () => {
  it('writes only the fields given', async () => {
    const { google, session } = await admin();
    const { item } = findContent(await loadWorkspace(session), 'momo');
    const result = await updateContent(session, 'shopit', item, { caption: 'New caption', scheduledAt: 0 });
    expect(result).toEqual({ changed: ['scheduledAt', 'caption'] });
    expect(google.calls.at(-1)).toEqual({
      op: 'update', path: 'clients/shopit/content/momo', mask: ['scheduledAt', 'caption'],
    });
    expect(google.doc('clients/shopit/content/momo')).toMatchObject({
      caption: 'New caption', scheduledAt: 0, title: 'Momo reel',
    });
  });

  it('appends a version and says "uploaded v2" when the link changes', async () => {
    const { google, session } = await admin();
    const { item } = findContent(await loadWorkspace(session), 'momo');
    const result = await updateContent(session, 'shopit', item, {
      driveLink: 'https://drive.google.com/file/d/9ZyXwVuTsRqPoNmLkJiHgFeDcBa987654/view',
    });
    expect(result.version).toBe(2);
    const doc = google.doc('clients/shopit/content/momo')!;
    expect(doc.driveFileId).toBe('9ZyXwVuTsRqPoNmLkJiHgFeDcBa987654');
    expect(doc.versions).toEqual([
      { link: DRIVE_LINK, mediaType: 'video', replacedAt: NOW, replacedByEmail: 'asha@limi.test' },
    ]);
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([
      expect.objectContaining({ kind: 'system', body: 'uploaded v2', authorName: 'Asha Admin' }),
    ]);
  });

  it('refuses a change that changes nothing', async () => {
    const { session } = await admin();
    const { item } = findContent(await loadWorkspace(session), 'momo');
    await expect(updateContent(session, 'shopit', item, { driveLink: DRIVE_LINK })).rejects.toThrow(
      'Nothing to change'
    );
  });
});

describe('moveContent', () => {
  it('writes the status and then the system comment', async () => {
    const { google, session } = await admin();
    await moveContent(session, 'shopit', 'momo', 'to-post');
    expect(google.calls.map((c) => c.op)).toEqual(['update', 'create']);
    expect(google.calls[0]).toMatchObject({ path: 'clients/shopit/content/momo', mask: ['status'] });
    expect(google.doc('clients/shopit/content/momo')!.status).toBe('to-post');
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([
      expect.objectContaining({ kind: 'system', body: 'moved this to To Post' }),
    ]);
  });

  it('writes no comment when the move is refused', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    await expect(moveContent(session, 'shopit', 'momo', 'posted')).rejects.toMatchObject({ status: 403 });
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([]);
  });
});

describe('stageLabel', () => {
  it('uses the app labels', () => {
    expect(stageLabel('to-post')).toBe('To Post');
  });
});

describe('reviewContent', () => {
  it('lets a client record a decision with a note', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    await reviewContent(session, 'shopit', 'momo', 'declined', 'Lower the music');
    expect(google.doc('clients/shopit/content/momo')).toMatchObject({
      clientReview: 'declined', reviewNote: 'Lower the music',
    });
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([
      expect.objectContaining({ body: 'declined this — "Lower the music"', authorName: 'Sam Shopit' }),
    ]);
  });

  it('clears the note when none is given', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    await reviewContent(session, 'shopit', 'offer', 'approved');
    expect(google.doc('clients/shopit/content/offer')).toMatchObject({ clientReview: 'approved', reviewNote: '' });
    expect(commentsOf(google, 'clients/shopit/content/offer')[0].body).toBe('approved this');
  });
});

describe('addComment', () => {
  it('adds a user comment at a moment in the video', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    const comment = await addComment(session, 'shopit', 'momo', 'Cut here', 42);
    expect(google.doc(`clients/shopit/content/momo/comments/${comment.id}`)).toEqual({
      id: comment.id, kind: 'user', body: 'Cut here', authorEmail: 'sam@shopit.test', authorName: 'Sam Shopit',
      createdAt: NOW, atSeconds: 42,
    });
  });
});

describe('addIdea', () => {
  it('adds a new idea as the signed-in person', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    const idea = await addIdea(session, 'shopit', {
      title: 'Lantern reel', description: 'Night shots', links: ['https://example.com/ref'], businessId: 'nepal',
    });
    expect(google.doc(`clients/shopit/ideas/${idea.id}`)).toEqual({
      id: idea.id, title: 'Lantern reel', description: 'Night shots', links: ['https://example.com/ref'],
      businessId: 'nepal', status: 'new', createdByEmail: 'sam@shopit.test', createdByName: 'Sam Shopit',
      createdAt: NOW,
    });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/limiWrites.test.ts`
Expected: FAIL with `createContent is not a function` and the like: the writes are not in `./limi.js` yet.

- [ ] **Step 3: Widen the imports of `server/mcp/limi.ts`**

Replace the import lines above `import { FirestoreError, type FirestoreClient } from './firestore.js';` with:

```ts
import './env.js';
import type {
  AppUser, Business, Campaign, Client, ClientReview, Comment, ContentItem, ContentStatus, Idea, MediaType,
  Platform, Version,
} from '../../src/types.js';
import { firstBusinessFirst } from '../../src/campaigns.js';
import { todaySources } from '../../src/today.js';
import { extractDriveFileId, generateId, getMediaInfo, STAGES } from '../../src/utils.js';
```

- [ ] **Step 4: Append the writes to `server/mcp/limi.ts`**

Append at the end of the file:

```ts
// ─── Writes ──────────────────────────────────────────────────────────────────

export function stageLabel(status: ContentStatus): string {
  return STAGES.find((s) => s.id === status)?.label ?? status;
}

/** Stored for Drive links only, as the app's form does. */
function driveFileIdOf(link: string): string {
  return getMediaInfo(link).provider === 'drive' ? extractDriveFileId(link.trim()) ?? '' : '';
}

/** An image link is a graphic; anything else a video, the app's default. */
export function mediaTypeFor(link: string): MediaType {
  return getMediaInfo(link).provider === 'image' ? 'graphic' : 'video';
}

const contentPath = (clientId: string, contentId: string) => `clients/${clientId}/content/${contentId}`;

// System entries double as the activity trail. As in the app, a failure here
// never fails the change the person asked for.
export async function writeSystemComment(session: Session, clientId: string, contentId: string, body: string) {
  try {
    const actor = actorOf(session);
    const id = generateId();
    const entry: Comment = {
      id, kind: 'system', body, authorEmail: actor.email, authorName: actor.name, createdAt: session.now(),
    };
    await session.fs.create(`${contentPath(clientId, contentId)}/comments`, id, { ...entry });
  } catch (err) {
    console.error('[limi-mcp] could not write activity entry', err);
  }
}

export interface NewContent {
  title: string;
  driveLink: string;
  mediaType: MediaType;
  caption?: string;
  hashtags?: string;
  platforms?: Platform[];
  notes?: string;
  status: ContentStatus;
  scheduledAt?: number;
  businessId: string;
  campaignId?: string;
  deliverableId?: string;
}

/** Mirrors addContent. */
export async function createContent(session: Session, clientId: string, data: NewContent): Promise<ContentItem> {
  const id = generateId();
  const item: ContentItem = {
    id,
    title: data.title,
    driveLink: data.driveLink,
    driveFileId: driveFileIdOf(data.driveLink),
    mediaType: data.mediaType,
    caption: data.caption || '',
    hashtags: data.hashtags || '',
    platforms: data.platforms ?? [],
    notes: data.notes || '',
    status: data.status,
    createdAt: session.now(),
    scheduledAt: data.scheduledAt || 0,
    uploadedByEmail: actorOf(session).email,
    clientReview: 'pending',
    reviewNote: '',
    businessId: data.businessId,
    campaignId: data.campaignId,
    deliverableId: data.deliverableId,
  };
  // encodeFields drops the unset filing fields, as defined() does in the app.
  await session.fs.create(`clients/${clientId}/content`, id, { ...item });
  return item;
}

export interface ContentChanges {
  title?: string;
  /** 0 takes the post off the schedule. */
  scheduledAt?: number;
  caption?: string;
  hashtags?: string;
  platforms?: Platform[];
  notes?: string;
  driveLink?: string;
  mediaType?: MediaType;
}

/**
 * Mirrors updateContent: only the given fields are written. A changed link is
 * a new cut, not a correction, so the old one is appended to `versions`
 * atomically and the thread says "uploaded vN".
 */
export async function updateContent(
  session: Session,
  clientId: string,
  previous: ContentItem,
  changes: ContentChanges
): Promise<{ changed: string[]; version?: number }> {
  const data: Record<string, unknown> = {};
  for (const key of ['title', 'scheduledAt', 'caption', 'hashtags', 'platforms', 'notes', 'mediaType'] as const) {
    if (changes[key] !== undefined) data[key] = changes[key];
  }
  const link = changes.driveLink?.trim();
  const linkChanged = link !== undefined && link !== previous.driveLink;
  let append: Record<string, unknown[]> | undefined;
  if (linkChanged) {
    data.driveLink = link;
    data.driveFileId = driveFileIdOf(link);
    const old: Version = {
      link: previous.driveLink,
      mediaType: previous.mediaType ?? 'video',
      replacedAt: session.now(),
      replacedByEmail: actorOf(session).email,
    };
    append = { versions: [{ ...old }] };
  }
  const changed = Object.keys(data);
  if (changed.length === 0) throw new LimiError('Nothing to change: every value given is already on the post.');

  await session.fs.update(contentPath(clientId, previous.id), data, append);
  if (!linkChanged) return { changed };
  const version = (previous.versions?.length ?? 0) + 2;
  await writeSystemComment(session, clientId, previous.id, `uploaded v${version}`);
  return { changed, version };
}

/** Mirrors updateContentStatus: the status, then the activity entry. */
export async function moveContent(session: Session, clientId: string, contentId: string, status: ContentStatus) {
  await session.fs.update(contentPath(clientId, contentId), { status });
  await writeSystemComment(session, clientId, contentId, `moved this to ${stageLabel(status)}`);
}

/** Mirrors updateClientReview: exactly the two fields a client may touch. */
export async function reviewContent(
  session: Session,
  clientId: string,
  contentId: string,
  review: ClientReview,
  note?: string
) {
  await session.fs.update(contentPath(clientId, contentId), { clientReview: review, reviewNote: note || '' });
  await writeSystemComment(session, clientId, contentId, note ? `${review} this — "${note}"` : `${review} this`);
}

/** Mirrors addComment. */
export async function addComment(
  session: Session,
  clientId: string,
  contentId: string,
  body: string,
  atSeconds?: number
): Promise<Comment> {
  const actor = actorOf(session);
  const id = generateId();
  const comment: Comment = {
    id,
    kind: 'user',
    body,
    authorEmail: actor.email,
    authorName: actor.name,
    createdAt: session.now(),
    ...(atSeconds !== undefined ? { atSeconds } : {}),
  };
  await session.fs.create(`${contentPath(clientId, contentId)}/comments`, id, { ...comment });
  return comment;
}

/** Mirrors addIdea. */
export async function addIdea(
  session: Session,
  clientId: string,
  data: { title: string; description: string; links: string[]; businessId?: string }
): Promise<Idea> {
  const actor = actorOf(session);
  const id = generateId();
  const idea: Idea = {
    id,
    title: data.title,
    description: data.description,
    links: data.links,
    ...(data.businessId ? { businessId: data.businessId } : {}),
    status: 'new',
    createdByEmail: actor.email,
    createdByName: actor.name,
    createdAt: session.now(),
  };
  await session.fs.create(`clients/${clientId}/ideas`, id, { ...idea });
  return idea;
}
```

- [ ] **Step 5: Run the tests and the types**

Run: `npx vitest run server/mcp/limiWrites.test.ts server/mcp/limi.test.ts`
Expected: PASS, 33 tests. "writes the status and then the system comment" sees exactly `['update', 'create']`; "appends a version and says \"uploaded v2\"" sees one version and one comment.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add server/mcp/limi.ts server/mcp/limiWrites.test.ts
git commit -q -F - <<'MSG'
Mirror the app's content, review, comment and idea writes

Each write sets only its own fields and leaves the same activity entry
the app does: "moved this to X", "uploaded vN", review decisions. A
failed activity entry never fails the change itself.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 7: The tools

**Files:**
- Create: `server/mcp/tools.ts`, `server/mcp/tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/tools.test.ts`:

```ts
// @vitest-environment node
import { runTool, TOOLS } from './tools.js';
import { at, limiGoogle, NOW, sessionAs } from './testData.js';

type Google = ReturnType<typeof limiGoogle>;

async function call(name: string, args: Record<string, unknown> = {}, uid = 'admin1', google: Google = limiGoogle()) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  const session = await sessionAs(google, uid);
  // The SDK validates arguments against the schema before a tool runs.
  const result = await runTool(tool, session, tool.input.parse(args));
  const text = (result.content[0] as { text: string }).text;
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // a plain sentence
  }
  return { result, text, data: data as any, google };
}

describe('the tool list', () => {
  it('has the thirteen tools of the spec', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'whoami', 'list_clients', 'list_content', 'get_content', 'get_today', 'list_campaigns', 'list_ideas',
      'create_content', 'update_content', 'move_content', 'review_content', 'add_comment', 'add_idea',
    ]);
  });

  it('says on every write that it changes data', () => {
    for (const tool of TOOLS.filter((t) => !t.readOnly)) {
      expect(tool.description).toContain('This changes data in Limi');
    }
    expect(TOOLS.filter((t) => !t.readOnly)).toHaveLength(6);
  });
});

describe('whoami', () => {
  it('names the person, the role and the clients', async () => {
    const { data } = await call('whoami', {}, 'cli1');
    expect(data).toEqual({
      name: 'Sam Shopit', email: 'sam@shopit.test', role: 'client', clients: [{ id: 'shopit', name: 'Shopit' }],
    });
  });
});

describe('list_clients', () => {
  it('counts posts per stage', async () => {
    const { data } = await call('list_clients');
    expect(data[0]).toEqual({
      id: 'shopit',
      name: 'Shopit',
      businesses: [{ id: 'main', name: 'Shopit' }, { id: 'nepal', name: 'Shopit Nepal' }],
      stages: { Editing: 1, Review: 2, 'To Post': 1, Posted: 0 },
      awaitingReview: 1,
      overdue: 1,
    });
  });
});

describe('list_content', () => {
  it('finds what is overdue for a client', async () => {
    const { data } = await call('list_content', { client: 'shopit', when: 'overdue' });
    expect(data.total).toBe(1);
    expect(data.posts[0]).toMatchObject({
      id: 'dashain', title: 'Dashain recap', stage: 'To Post', late: true,
      scheduled: { iso: '2026-10-10T09:00+05:45', kathmandu: 'Sat 10 Oct 2026, 9:00 AM', relative: '4 days late' },
    });
  });

  it('filters by campaign, stage and review state', async () => {
    const { data } = await call('list_content', { campaign: 'tihar', needs_review: true });
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['momo']);
    expect(data.posts[0]).toMatchObject({ campaign: 'Tihar 2026', business: 'Shopit' });
  });

  it('filters by business', async () => {
    const { data } = await call('list_content', { business: 'Shopit Nepal' });
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['offer']);
  });

  it('searches titles and captions', async () => {
    const { data } = await call('list_content', { search: 'straight to you' });
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['momo']);
  });

  it('caps the list and reports the total', async () => {
    const { data } = await call('list_content', { limit: 2 });
    expect(data).toMatchObject({ total: 5, shown: 2 });
    // Scheduled soonest first.
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['laptop', 'dashain']);
  });

  it('shows a client nothing in Editing', async () => {
    const { data } = await call('list_content', {}, 'cli1');
    expect(data.posts.map((p: { id: string }) => p.id)).not.toContain('draft');
  });

  it('asks back about an unknown client', async () => {
    const { result, text } = await call('list_content', { client: 'Momo House' });
    expect(result.isError).toBe(true);
    expect(text).toBe('No client matches "Momo House". The clients you can see: Shopit, Everest IT.');
  });
});

describe('get_content', () => {
  it('returns every field, versions and the thread', async () => {
    const { data } = await call('get_content', { id: 'momo' });
    expect(data).toMatchObject({
      id: 'momo', title: 'Momo reel', business: 'Shopit', campaign: 'Tihar 2026', deliverable: '3 Reels',
      caption: 'Steaming momo, straight to you', hashtags: '#momo', platforms: ['instagram'],
      notes: 'Use the v2 music', media: { type: 'video', host: 'Google Drive' }, versions: [],
    });
    expect(data.comments.map((c: { body: string }) => c.body)).toEqual(['moved this to Review', 'Looks good']);
    expect(data.comments[1]).toMatchObject({ author: 'Sam Shopit', atSeconds: 12 });
  });

  it('keeps team notes from a client', async () => {
    const { data } = await call('get_content', { id: 'momo' }, 'cli1');
    expect(data).not.toHaveProperty('notes');
  });

  it('says plainly when a post cannot be seen', async () => {
    const { result, text } = await call('get_content', { id: 'laptop' }, 'cli1');
    expect(result.isError).toBe(true);
    expect(text).toBe("No such post (or you can't see it).");
  });
});

describe('get_today', () => {
  it('builds the queue', async () => {
    const { data } = await call('get_today');
    const ids = (group: { id: string }[]) => group.map((p) => p.id);
    expect(data.today).toBe('Wed 14 Oct 2026, 10:00 AM');
    expect(ids(data.needsReview)).toEqual(['momo']);
    expect(ids(data.needsRework)).toEqual(['offer']);
    expect(ids(data.goingOutSoon)).toEqual(['dashain', 'momo']);
    expect(ids(data.overdue)).toEqual(['dashain']);
  });
});

describe('list_campaigns', () => {
  it('reports progress, and the brief to the team', async () => {
    const { data } = await call('list_campaigns', { client: 'Shopit' });
    expect(data[0].campaigns[0]).toEqual({
      id: 'tihar', name: 'Tihar 2026', business: 'Shopit', status: 'Live', dates: 'Oct 20 – Nov 5',
      progress: '0 of 3 posted', deliverables: [{ label: '3 Reels', made: 1, posted: 0, planned: 3 }],
      brief: 'Internal: push the gift boxes',
    });
  });

  it('keeps the brief from a client', async () => {
    const { data } = await call('list_campaigns', {}, 'cli1');
    expect(data[0].campaigns[0]).not.toHaveProperty('brief');
  });
});

describe('list_ideas', () => {
  it('lists ideas, filtered by status', async () => {
    const { data } = await call('list_ideas', { client: 'Shopit', status: 'new' });
    expect(data).toEqual([
      {
        client: 'Shopit',
        ideas: [
          {
            id: 'i1', title: 'Tihar lights', description: 'Diyas at dusk', links: [], status: 'new',
            business: 'Shopit', by: 'Sam Shopit', created: expect.any(Object),
          },
        ],
      },
    ]);
  });
});

describe('create_content', () => {
  it('creates a post in Editing under the campaign business', async () => {
    const { data, google } = await call('create_content', {
      client: 'Shopit', title: 'Tihar teaser', campaign: 'Tihar', scheduled: '2026-10-20 18:00',
      link: 'https://example.com/teaser.png',
    });
    expect(data.created).toMatchObject({ title: 'Tihar teaser', stage: 'Editing', campaign: 'Tihar 2026' });
    const doc = google.doc(`clients/shopit/content/${data.created.id}`);
    expect(doc).toMatchObject({
      status: 'editing', businessId: 'main', campaignId: 'tihar', mediaType: 'graphic', scheduledAt: at(10, 20, 18),
    });
  });

  it('is refused to a client in plain words', async () => {
    const { result, text } = await call('create_content', { client: 'Shopit', title: 'Mine' }, 'cli1');
    expect(result.isError).toBe(true);
    expect(text).toBe("Your Limi role can't do that.");
  });

  it('refuses a date it cannot read', async () => {
    const { text } = await call('create_content', { client: 'Shopit', title: 'X', scheduled: 'next Friday' });
    expect(text).toContain('Use 2026-10-20 or 2026-10-20 15:30 (Kathmandu time).');
  });
});

describe('update_content', () => {
  it('appends a version when the link changes', async () => {
    const { text, google } = await call('update_content', {
      id: 'momo', link: 'https://www.youtube.com/watch?v=abcdefghijk',
    });
    expect(JSON.parse(text)).toEqual({
      updated: 'Momo reel', changed: ['driveLink', 'driveFileId'], note: 'Uploaded as v2.',
    });
    expect(google.doc('clients/shopit/content/momo')!.versions).toHaveLength(1);
  });

  it('unschedules on an empty date', async () => {
    const { google } = await call('update_content', { id: 'dashain', scheduled: '' });
    expect(google.doc('clients/shopit/content/dashain')!.scheduledAt).toBe(0);
  });
});

describe('move_content', () => {
  it('moves the post and notes it on the thread', async () => {
    const { text, google } = await call('move_content', { id: 'momo', stage: 'to-post' });
    expect(text).toBe('Moved Momo reel to To Post.');
    const ops = google.calls.filter((c) => c.op !== 'get' && c.op !== 'list');
    expect(ops.map((c) => c.op)).toEqual(['update', 'create']);
  });

  it("turns a Firestore refusal into Limi's plain message", async () => {
    const { result, text, google } = await call('move_content', { id: 'momo', stage: 'posted' }, 'cli1');
    expect(result.isError).toBe(true);
    expect(text).toBe("Your Limi role can't do that.");
    expect(google.doc('clients/shopit/content/momo')!.status).toBe('review');
  });
});

describe('review_content', () => {
  it('records a client decision with a note', async () => {
    const { text, google } = await call(
      'review_content', { id: 'momo', decision: 'approved', note: 'Lower the music' }, 'cli1'
    );
    expect(text).toBe('Marked Momo reel approved, with the note "Lower the music".');
    expect(google.doc('clients/shopit/content/momo')).toMatchObject({
      clientReview: 'approved', reviewNote: 'Lower the music',
    });
  });

  it('refuses a client acting on a post that left Review', async () => {
    const { text } = await call('review_content', { id: 'dashain', decision: 'declined' }, 'cli1');
    expect(text).toBe("Dashain recap isn't waiting for your review.");
  });
});

describe('add_comment', () => {
  it('comments at a moment in the video', async () => {
    const { text, google } = await call('add_comment', { id: 'momo', body: 'Cut here', at_seconds: 42 }, 'cli1');
    expect(text).toBe('Commented on Momo reel.');
    const added = google
      .paths('clients/shopit/content/momo/comments/')
      .map((p) => google.doc(p)!)
      .find((c) => c.createdAt === NOW);
    expect(added).toMatchObject({ kind: 'user', body: 'Cut here', atSeconds: 42 });
  });
});

describe('add_idea', () => {
  it('adds an idea for a business', async () => {
    const { text, google } = await call(
      'add_idea', { client: 'Shopit', title: 'Lantern reel', business: 'nepal' }, 'cli1'
    );
    expect(text).toBe('Added the idea "Lantern reel" for Shopit.');
    const ideas = google.paths('clients/shopit/ideas/').map((p) => google.doc(p)!);
    expect(ideas.find((i) => i.title === 'Lantern reel')).toMatchObject({ businessId: 'nepal', status: 'new' });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/tools.test.ts`
Expected: FAIL with `Failed to load url ./tools.js`.

- [ ] **Step 3: Create `server/mcp/tools.ts`**

Things the app already does, and the tools therefore do too:

- A client never sees Editing, team notes or campaign briefs.
- A client can only review a post that is in Review.
- Filing under a campaign files under that campaign's business.

```ts
import './env.js';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/server';
import type { ContentItem } from '../../src/types.js';
import {
  businessIdOf, campaignIdOf, campaignProgress, campaignStatusMeta, deliverableProgress, formatDateRange, NO_CAMPAIGN,
  scopeContent, sortCampaigns,
} from '../../src/campaigns.js';
import { buildToday, isDueWithin, isLate, slotLabel, type TodayEntry } from '../../src/today.js';
import { captionOf, getMediaInfo, mediaTypeOf, STAGES, teamNotesOf } from '../../src/utils.js';
import { FirestoreError } from './firestore.js';
import {
  addComment, addIdea, createContent, findContent, kathmanduIso, kathmanduText, LimiError, listClients,
  loadComments, loadIdeas, loadWorkspace, mediaTypeFor, moveContent, parseWhen, pick, plainMessage,
  reviewContent, stageLabel, updateContent, type ClientData, type Session,
} from './limi.js';

// ─── Shapes ──────────────────────────────────────────────────────────────────

export interface LimiTool {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject;
  readOnly: boolean;
  run(session: Session, args: never): Promise<unknown>;
}

function defineTool<S extends z.ZodObject>(
  tool: Omit<LimiTool, 'input' | 'run'> & { input: S; run(session: Session, args: z.output<S>): Promise<unknown> }
): LimiTool {
  return tool;
}

/** Runs a tool and turns any failure into one plain sentence. */
export async function runTool(tool: LimiTool, session: Session, args: unknown): Promise<CallToolResult> {
  try {
    const out = await (tool.run as (s: Session, a: unknown) => Promise<unknown>)(session, args);
    return { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] };
  } catch (err) {
    // Refusals and missing posts are answers, not faults.
    const expected =
      err instanceof LimiError || (err instanceof FirestoreError && (err.status === 403 || err.status === 404));
    if (!expected) console.error(`[limi-mcp] ${tool.name} failed`, err);
    return { content: [{ type: 'text', text: plainMessage(err) }], isError: true };
  }
}

const WRITES = 'This changes data in Limi: confirm with the person before calling it.';
const DATES = 'Dates are Kathmandu time, written 2026-10-20 or 2026-10-20 15:30.';

const stage = z.enum(['editing', 'review', 'to-post', 'posted']);
const platform = z.enum(['instagram', 'facebook', 'tiktok']);
const postId = z.string().min(1).describe('The post id, from list_content or get_today.');

// ─── Presenting ──────────────────────────────────────────────────────────────

function when(ms: number | undefined, now: number) {
  if (!ms || ms <= 0) return null;
  return { iso: kathmanduIso(ms), kathmandu: kathmanduText(ms), relative: slotLabel(ms, now)?.text ?? '' };
}

function summary(client: ClientData, item: ContentItem, now: number) {
  const businessId = businessIdOf(item, client.businesses);
  const campaignId = campaignIdOf(item, client.campaigns);
  return {
    id: item.id,
    title: item.title,
    client: client.name,
    ...(client.businesses.length > 1
      ? { business: client.businesses.find((b) => b.id === businessId)?.name }
      : {}),
    ...(campaignId ? { campaign: client.campaigns.find((c) => c.id === campaignId)?.name } : {}),
    stage: stageLabel(item.status),
    review: item.clientReview,
    scheduled: when(item.scheduledAt, now),
    late: isLate(item, now),
  };
}

const entrySummary = (clients: ClientData[], now: number) => (e: TodayEntry) =>
  summary(clients.find((c) => c.id === e.clientId)!, e.item, now);

// Scheduled first, soonest first; then the unscheduled, newest first.
function bySlot(a: ContentItem, b: ContentItem): number {
  const sa = a.scheduledAt ?? 0;
  const sb = b.scheduledAt ?? 0;
  if (sa > 0 && sb > 0) return sa - sb;
  if (sa > 0) return -1;
  if (sb > 0) return 1;
  return b.createdAt - a.createdAt;
}

function scopeClients(clients: ClientData[], query: string | undefined): ClientData[] {
  return query ? [pick(clients, query, 'client')] : clients;
}

/** A business or campaign by name across clients; a shared name asks which client. */
function pickAcross<T extends { id: string; name: string }>(
  clients: ClientData[],
  query: string,
  what: string,
  of: (c: ClientData) => T[]
): { client: ClientData; found: T } {
  const all = clients.flatMap((client) =>
    of(client).map((found) => ({ id: found.id, name: found.name, client, found }))
  );
  const hit = pick(all, query, what, (x) => (clients.length > 1 ? `${x.name} (${x.client.name})` : x.name));
  return { client: hit.client, found: hit.found };
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const whoami = defineTool({
  name: 'whoami',
  title: 'Who am I in Limi',
  description: 'The signed-in Limi person: name, email, role, and the clients this login can see.',
  readOnly: true,
  input: z.object({}),
  async run(session) {
    const clients = await listClients(session);
    const { name, email, role } = session.profile;
    return { name, email, role, clients: clients.map((c) => ({ id: c.id, name: c.name })) };
  },
});

const listClientsTool = defineTool({
  name: 'list_clients',
  title: 'List clients',
  description: 'Every client this login can see, with its businesses and how many posts sit in each stage.',
  readOnly: true,
  input: z.object({}),
  async run(session) {
    const now = session.now();
    const clients = await loadWorkspace(session);
    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      businesses: c.businesses.map((b) => ({ id: b.id, name: b.name })),
      stages: Object.fromEntries(STAGES.map((s) => [s.label, c.content.filter((i) => i.status === s.id).length])),
      awaitingReview: c.content.filter((i) => i.status === 'review' && i.clientReview === 'pending').length,
      overdue: c.content.filter((i) => isLate(i, now)).length,
    }));
  },
});

const listContent = defineTool({
  name: 'list_content',
  title: 'List posts',
  description:
    'Posts, filtered. "when" is overdue, today, next7, next31 or unscheduled; needs_review means in Review ' +
    'with no decision yet; search matches the title and caption. At most 50 are returned, with the total.',
  readOnly: true,
  input: z.object({
    client: z.string().optional().describe('Client name or id.'),
    business: z.string().optional().describe('Business name or id.'),
    campaign: z.string().optional().describe('Campaign name or id, or "none" for posts outside every campaign.'),
    stage: stage.optional(),
    when: z.enum(['overdue', 'today', 'next7', 'next31', 'unscheduled']).optional(),
    needs_review: z.boolean().optional(),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async run(session, args) {
    const now = session.now();
    let clients = scopeClients(await loadWorkspace(session), args.client);
    let businessId: string | undefined;
    let campaignId: string | undefined;
    if (args.business) {
      const hit = pickAcross(clients, args.business, 'business', (c) => c.businesses);
      clients = [hit.client];
      businessId = hit.found.id;
    }
    if (args.campaign && args.campaign.trim().toLowerCase() === 'none') {
      campaignId = NO_CAMPAIGN;
    } else if (args.campaign) {
      const hit = pickAcross(clients, args.campaign, 'campaign', (c) => c.campaigns);
      clients = [hit.client];
      campaignId = hit.found.id;
    }
    const q = args.search?.trim().toLowerCase();
    const matches = clients.flatMap((client) =>
      scopeContent(client.content, { businessId, campaignId }, client.businesses, client.campaigns)
        .filter((i) => !args.stage || i.status === args.stage)
        .filter((i) => !args.needs_review || (i.status === 'review' && i.clientReview === 'pending'))
        .filter((i) => {
          switch (args.when) {
            case 'overdue': return isLate(i, now);
            case 'today': return isDueWithin(i, now, 1);
            case 'next7': return isDueWithin(i, now, 7);
            case 'next31': return isDueWithin(i, now, 31);
            case 'unscheduled': return !(i.scheduledAt && i.scheduledAt > 0) && i.status !== 'posted';
            default: return true;
          }
        })
        .filter((i) => !q || i.title.toLowerCase().includes(q) || captionOf(i).toLowerCase().includes(q))
        .map((item) => ({ client, item }))
    );
    matches.sort((a, b) => bySlot(a.item, b.item));
    const shown = matches.slice(0, args.limit ?? 50);
    return {
      total: matches.length,
      shown: shown.length,
      posts: shown.map(({ client, item }) => summary(client, item, now)),
    };
  },
});

const getContent = defineTool({
  name: 'get_content',
  title: 'Get one post',
  description: 'One post with every field, its earlier versions and its comment thread.',
  readOnly: true,
  input: z.object({ id: postId }),
  async run(session, args) {
    const now = session.now();
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    const comments = await loadComments(session, client.id, item.id);
    const campaign = client.campaigns.find((c) => c.id === campaignIdOf(item, client.campaigns));
    const isClient = session.profile.role === 'client';
    return {
      ...summary(client, item, now),
      business: client.businesses.find((b) => b.id === businessIdOf(item, client.businesses))?.name,
      ...(campaign
        ? { deliverable: campaign.deliverables.find((d) => d.id === item.deliverableId)?.label }
        : {}),
      reviewNote: item.reviewNote || '',
      caption: captionOf(item),
      hashtags: item.hashtags ?? '',
      platforms: item.platforms ?? [],
      // Internal remarks: the app never shows them to a client.
      ...(isClient ? {} : { notes: teamNotesOf(item) }),
      link: item.driveLink,
      media: { type: mediaTypeOf(item), host: getMediaInfo(item.driveLink).label },
      created: when(item.createdAt, now),
      uploadedBy: item.uploadedByEmail,
      versions: (item.versions ?? []).map((v, n) => ({
        version: n + 1,
        link: v.link,
        replaced: when(v.replacedAt, now),
        replacedBy: v.replacedByEmail,
      })),
      comments: comments.map((c) => ({
        kind: c.kind,
        author: c.authorName,
        body: c.body,
        at: when(c.createdAt, now),
        ...(c.atSeconds !== undefined ? { atSeconds: c.atSeconds } : {}),
      })),
    };
  },
});

const getToday = defineTool({
  name: 'get_today',
  title: 'Today',
  description:
    'The Today queue: posts waiting for a review decision, declined posts that need rework, posts going ' +
    'out within a week, and overdue posts.',
  readOnly: true,
  input: z.object({}),
  async run(session) {
    const now = session.now();
    const clients = await loadWorkspace(session);
    const groups = buildToday(clients, now);
    const present = entrySummary(clients, now);
    return {
      today: kathmanduText(now),
      needsReview: groups.waitingOnClient.map(present),
      needsRework: groups.needsRework.map(present),
      goingOutSoon: groups.goingOutSoon.map(present),
      overdue: clients.flatMap((c) => c.content.filter((i) => isLate(i, now)).map((i) => summary(c, i, now))),
    };
  },
});

const listCampaigns = defineTool({
  name: 'list_campaigns',
  title: 'List campaigns',
  description: 'Campaigns per client: status, dates and progress (posted of planned).',
  readOnly: true,
  input: z.object({
    client: z.string().optional().describe('Client name or id.'),
    status: z.enum(['planning', 'live', 'completed']).optional(),
  }),
  async run(session, args) {
    const clients = scopeClients(await loadWorkspace(session), args.client);
    const isClient = session.profile.role === 'client';
    return clients.map((client) => ({
      client: client.name,
      campaigns: sortCampaigns(client.campaigns)
        .filter((c) => !args.status || c.status === args.status)
        .map((c) => {
          const progress = campaignProgress(c, client.content);
          return {
            id: c.id,
            name: c.name,
            business: client.businesses.find((b) => b.id === c.businessId)?.name,
            status: campaignStatusMeta(c.status).label,
            dates: formatDateRange(c.startDate, c.endDate),
            progress: `${progress.posted} of ${progress.planned} posted`,
            deliverables: deliverableProgress(c, client.content).map((d) => ({
              label: d.deliverable.label,
              made: d.items.length,
              posted: d.posted,
              planned: d.planned,
            })),
            // Briefs stay internal, as in the client portal.
            ...(isClient ? {} : { brief: c.brief }),
          };
        }),
    }));
  },
});

const listIdeas = defineTool({
  name: 'list_ideas',
  title: 'List ideas',
  description: 'Ideas per client, newest first, optionally only one status.',
  readOnly: true,
  input: z.object({
    client: z.string().optional().describe('Client name or id.'),
    status: z.enum(['new', 'accepted', 'declined']).optional(),
  }),
  async run(session, args) {
    const now = session.now();
    const clients = scopeClients(await loadWorkspace(session), args.client);
    return Promise.all(
      clients.map(async (client) => ({
        client: client.name,
        ideas: (await loadIdeas(session, client.id))
          .filter((i) => !args.status || i.status === args.status)
          .map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            links: i.links ?? [],
            status: i.status,
            ...(client.businesses.length > 1
              ? { business: client.businesses.find((b) => b.id === businessIdOf(i, client.businesses))?.name }
              : {}),
            by: i.createdByName,
            created: when(i.createdAt, now),
            ...(i.decisionNote ? { decisionNote: i.decisionNote } : {}),
          })),
      }))
    );
  },
});

const createContentTool = defineTool({
  name: 'create_content',
  title: 'Create a post',
  description: `Adds a post to a client's board, in Editing unless another stage is given. ${DATES} ${WRITES}`,
  readOnly: false,
  input: z.object({
    client: z.string().min(1).describe('Client name or id.'),
    title: z.string().min(1).max(200),
    business: z.string().optional().describe("Business name or id. Defaults to the client's first business."),
    campaign: z.string().optional().describe('Campaign name or id. Files the post under that campaign.'),
    stage: stage.optional(),
    scheduled: z.string().optional().describe('When it goes out.'),
    caption: z.string().optional(),
    hashtags: z.string().optional(),
    platforms: z.array(platform).optional(),
    link: z.string().optional().describe('Drive (or other) link to the media.'),
    media_type: z.enum(['video', 'graphic']).optional().describe('Read from the link when left out.'),
    notes: z.string().optional().describe('Internal remarks for the team.'),
  }),
  async run(session, args) {
    const client = pick(await loadWorkspace(session), args.client, 'client');
    const campaign = args.campaign ? pick(client.campaigns, args.campaign, 'campaign') : undefined;
    const business = args.business ? pick(client.businesses, args.business, 'business') : undefined;
    if (campaign && business && campaign.businessId !== business.id) {
      throw new LimiError(`${campaign.name} belongs to another business than ${business.name}.`);
    }
    // A campaign files the post under the campaign's business, as the form does.
    const businessId = campaign?.businessId ?? business?.id ?? client.businesses[0]?.id;
    if (!businessId) throw new LimiError(`${client.name} has no business yet. Add one in the app first.`);
    const link = args.link?.trim() ?? '';
    const item = await createContent(session, client.id, {
      title: args.title.trim(),
      driveLink: link,
      mediaType: args.media_type ?? mediaTypeFor(link),
      caption: args.caption,
      hashtags: args.hashtags,
      platforms: args.platforms,
      notes: args.notes,
      status: args.stage ?? 'editing',
      scheduledAt: args.scheduled ? parseWhen(args.scheduled) : undefined,
      businessId,
      campaignId: campaign?.id,
    });
    return { created: summary({ ...client, content: [...client.content, item] }, item, session.now()) };
  },
});

const updateContentTool = defineTool({
  name: 'update_content',
  title: 'Edit a post',
  description:
    'Changes any of title, schedule, caption, hashtags, platforms, notes and link. A new link keeps the ' +
    `old one as a version and notes "uploaded vN" on the thread. Pass scheduled "" to unschedule. ${DATES} ${WRITES}`,
  readOnly: false,
  input: z.object({
    id: postId,
    title: z.string().min(1).max(200).optional(),
    scheduled: z.string().optional(),
    caption: z.string().optional(),
    hashtags: z.string().optional(),
    platforms: z.array(platform).optional(),
    notes: z.string().optional(),
    link: z.string().min(1).optional(),
    media_type: z.enum(['video', 'graphic']).optional(),
  }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    const scheduledAt =
      args.scheduled === undefined ? undefined : args.scheduled.trim() === '' ? 0 : parseWhen(args.scheduled);
    const result = await updateContent(session, client.id, item, {
      title: args.title?.trim(),
      scheduledAt,
      caption: args.caption,
      hashtags: args.hashtags,
      platforms: args.platforms,
      notes: args.notes,
      driveLink: args.link,
      mediaType: args.media_type,
    });
    return {
      updated: item.title,
      changed: result.changed,
      ...(result.version ? { note: `Uploaded as v${result.version}.` } : {}),
    };
  },
});

const moveContentTool = defineTool({
  name: 'move_content',
  title: 'Move a post to another stage',
  description: `Moves a post to Editing, Review, To Post or Posted, and notes the move on its thread. ${WRITES}`,
  readOnly: false,
  input: z.object({ id: postId, stage }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    if (item.status === args.stage) return `${item.title} is already in ${stageLabel(args.stage)}.`;
    await moveContent(session, client.id, item.id, args.stage);
    return `Moved ${item.title} to ${stageLabel(args.stage)}.`;
  },
});

const reviewContentTool = defineTool({
  name: 'review_content',
  title: 'Record a review decision',
  description: `Approves or declines a post (or resets it to pending), with an optional note to the team. ${WRITES}`,
  readOnly: false,
  input: z.object({
    id: postId,
    decision: z.enum(['approved', 'declined', 'pending']),
    note: z.string().max(1000).optional(),
  }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    // The rule the app enforces: a client acts on a post only while it is in Review.
    if (session.profile.role === 'client' && item.status !== 'review') {
      throw new LimiError(`${item.title} isn't waiting for your review.`);
    }
    const note = args.note?.trim();
    await reviewContent(session, client.id, item.id, args.decision, note);
    return `Marked ${item.title} ${args.decision}${note ? `, with the note "${note}"` : ''}.`;
  },
});

const addCommentTool = defineTool({
  name: 'add_comment',
  title: 'Comment on a post',
  description: `Adds a comment to a post's thread, optionally at a moment in the video. ${WRITES}`,
  readOnly: false,
  input: z.object({
    id: postId,
    body: z.string().min(1).max(4000),
    at_seconds: z.number().min(0).optional().describe('Seconds into the video the comment refers to.'),
  }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    await addComment(session, client.id, item.id, args.body.trim(), args.at_seconds);
    return `Commented on ${item.title}.`;
  },
});

const addIdeaTool = defineTool({
  name: 'add_idea',
  title: 'Add an idea',
  description: `Adds an idea for a client, as new, for the team to triage. ${WRITES}`,
  readOnly: false,
  input: z.object({
    client: z.string().min(1).describe('Client name or id.'),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    links: z.array(z.string()).max(20).optional(),
    business: z.string().optional().describe('Business name or id.'),
  }),
  async run(session, args) {
    const client = pick(await loadWorkspace(session), args.client, 'client');
    const business = args.business ? pick(client.businesses, args.business, 'business') : undefined;
    const idea = await addIdea(session, client.id, {
      title: args.title.trim(),
      description: args.description?.trim() ?? '',
      links: args.links ?? [],
      businessId: business?.id,
    });
    return `Added the idea "${idea.title}" for ${client.name}.`;
  },
});

export const TOOLS: LimiTool[] = [
  whoami,
  listClientsTool,
  listContent,
  getContent,
  getToday,
  listCampaigns,
  listIdeas,
  createContentTool,
  updateContentTool,
  moveContentTool,
  reviewContentTool,
  addCommentTool,
  addIdeaTool,
];
```

- [ ] **Step 4: Run the tests and the types**

Run: `npx vitest run server/mcp/tools.test.ts`
Expected: PASS, 29 tests, with no `stderr` output (refusals are not logged as faults).

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/mcp/tools.ts server/mcp/tools.test.ts
git commit -q -F - <<'MSG'
Define the Limi MCP tools

Seven reads and six writes. Each write says in its description that it
changes data, so Claude confirms first. Failures come back as one plain
sentence, never a stack trace.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 8: The sign-in page

**Files:**
- Create: `server/mcp/signInPage.ts`, `server/mcp/signInPage.test.ts`

The colours are the tokens in `tailwind.config.js`:

- light: `canvas` #ffffff, `tint` #f7f7f5, `hairline` #eae9e5, `ink` #37352f / `soft` #52514c / `faint` #6b6a65, `brand` #dc2626 (hover #b91c1c, text #b91c1c, soft #fdf2f2), `focus` #37352f;
- dark: `canvas` #191919, `tint` #252525, `hairline` #333333, `ink` #e9e9e7 / #b4b4b0 / #999995, brand text #f87171, brand soft #2a1414, `focus` #e9e9e7.

The logo is the red lettered square the app's `Logo` falls back to, drawn in CSS. `public/limi-logo.png` and `public/limi-icon.png` are not in the repository, so a deployment built from it has no image to point at.

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/signInPage.test.ts`:

```ts
// @vitest-environment node
import { escapeHtml, renderErrorPage, renderSignInPage, type SignInFields } from './signInPage.js';

const FIELDS: SignInFields = {
  client_id: 'client-1',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  state: '"><script>alert(1)</script>',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
  response_type: 'code',
};

describe('escapeHtml', () => {
  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('renderSignInPage', () => {
  it('asks for the email and password and says what Claude can do', async () => {
    const res = renderSignInPage({ fields: FIELDS, clientName: 'Claude' });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<h1>Connect Claude to Limi</h1>');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('It never deletes anything.');
    expect(html).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(html).toContain('<form method="post" action="/oauth/authorize">');
  });

  it('carries the request through hidden fields, escaped', async () => {
    const html = await renderSignInPage({ fields: FIELDS, clientName: 'Claude' }).text();
    expect(html).toContain('name="state" value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).toContain('name="redirect_uri" value="https://claude.ai/api/mcp/auth_callback"');
  });

  it('runs no script and has no inline event handlers', async () => {
    const html = await renderSignInPage({
      fields: FIELDS, clientName: '<img src=x onerror=alert(1)>', email: '"><b>', error: '<i>bad</i>',
    }).text();
    expect(html).not.toMatch(/<script/i);
    // No tag carries an on…= attribute; the escaped text above is not a tag.
    expect(html).not.toMatch(/<[^>]*\son[a-z]+=/i);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('value="&quot;&gt;&lt;b&gt;"');
    expect(html).toContain('&lt;i&gt;bad&lt;/i&gt;');
  });

  it('shows an error when there is one', async () => {
    const html = await renderSignInPage({ fields: FIELDS, clientName: 'Claude', error: 'Invalid email or password.' }).text();
    expect(html).toContain('<p class="error" role="alert">Invalid email or password.</p>');
  });

  it('can never be framed', () => {
    const res = renderSignInPage({ fields: FIELDS, clientName: 'Claude' });
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses the light and dark tokens', async () => {
    const html = await renderSignInPage({ fields: FIELDS, clientName: 'Claude' }).text();
    expect(html).toContain('--brand: #dc2626');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('--canvas: #191919');
  });
});

describe('renderErrorPage', () => {
  it('shows the message, escaped, with the same headers', async () => {
    const res = renderErrorPage(400, 'Bad <link>');
    expect(res.status).toBe(400);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(await res.text()).toContain('<p>Bad &lt;link&gt;</p>');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/signInPage.test.ts`
Expected: FAIL with `Failed to load url ./signInPage.js`.

- [ ] **Step 3: Create `server/mcp/signInPage.ts`**

```ts
// The one page a person sees while connecting Claude: server-rendered, no
// script at all, in the app's light and dark colours (tailwind.config.js).

/** The OAuth request, carried through the form as hidden fields. */
export interface SignInFields {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  response_type: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// No script may run, the page may not be framed, and nothing but Google Fonts
// loads. form-action is left unset on purpose: Chrome applies it to the
// redirect after the POST, which would block the return to Claude.
const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Tokens from tailwind.config.js: canvas, tint, hairline, ink, brand, focus.
const STYLE = `
:root {
  color-scheme: light dark;
  --canvas: #ffffff; --tint: #f7f7f5; --hairline: #eae9e5;
  --ink: #37352f; --ink-soft: #52514c; --ink-faint: #6b6a65;
  --brand: #dc2626; --brand-hover: #b91c1c; --brand-text: #b91c1c; --brand-soft: #fdf2f2;
  --focus: #37352f;
}
@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #191919; --tint: #252525; --hairline: #333333;
    --ink: #e9e9e7; --ink-soft: #b4b4b0; --ink-faint: #999995;
    --brand-text: #f87171; --brand-soft: #2a1414;
    --focus: #e9e9e7;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px 16px; background: var(--tint); color: var(--ink);
  font: 15px/1.5 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
}
main {
  width: 100%; max-width: 400px; background: var(--canvas);
  border: 1px solid var(--hairline); border-radius: 12px; padding: 32px 28px;
}
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
.mark {
  width: 32px; height: 32px; border-radius: 6px; background: var(--brand); color: #ffffff;
  display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 17px;
}
.word { font-weight: 700; font-size: 20px; letter-spacing: -0.01em; }
h1 { font-size: 20px; line-height: 1.3; margin: 0 0 8px; font-weight: 600; }
p { margin: 0 0 16px; color: var(--ink-soft); }
.small { font-size: 13px; color: var(--ink-faint); }
label { display: block; font-size: 13px; font-weight: 500; margin: 16px 0 6px; }
input[type=email], input[type=password] {
  width: 100%; min-height: 44px; padding: 10px 12px; font: inherit; color: var(--ink);
  background: var(--canvas); border: 1px solid var(--hairline); border-radius: 6px;
}
input:focus-visible, button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
button {
  width: 100%; min-height: 44px; margin-top: 24px; border: 0; border-radius: 6px; cursor: pointer;
  background: var(--brand); color: #ffffff; font: inherit; font-weight: 600;
}
button:hover { background: var(--brand-hover); }
.error {
  margin: 16px 0 0; padding: 10px 12px; border-radius: 6px;
  background: var(--brand-soft); color: var(--brand-text); font-size: 14px;
}
`;

function page(title: string, body: string, status: number): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="brand"><span class="mark" aria-hidden="true">L</span><span class="word">limi</span></div>
${body}
</main>
</body>
</html>`;
  return new Response(html, { status, headers: HEADERS });
}

export function renderSignInPage({
  fields,
  clientName,
  email = '',
  error = '',
}: {
  fields: SignInFields;
  clientName: string;
  email?: string;
  error?: string;
}): Response {
  const hidden = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join('\n');
  const body = `<h1>Connect Claude to Limi</h1>
<p>Sign in with your Limi email and password. Claude will see the clients, posts, campaigns and ideas you can see, and, after asking you, can add posts, comments and ideas, move posts and record reviews. It never deletes anything.</p>
<p class="small">Requested by ${escapeHtml(clientName)}</p>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post" action="/oauth/authorize">
${hidden}
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="username" required value="${escapeHtml(email)}">
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Sign in and connect</button>
</form>`;
  return page('Connect Claude to Limi', body, 200);
}

export function renderErrorPage(status: number, message: string): Response {
  return page('Limi', `<h1>Can't connect</h1>\n<p>${escapeHtml(message)}</p>`, status);
}
```

- [ ] **Step 4: Run the tests and the types**

Run: `npx vitest run server/mcp/signInPage.test.ts`
Expected: PASS, 8 tests.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/mcp/signInPage.ts server/mcp/signInPage.test.ts
git commit -q -F - <<'MSG'
Add the Connect Claude to Limi sign-in page

Server-rendered with no script at all, in the app's light and dark
tokens. Every reflected value is escaped, and the page cannot be framed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 9: OAuth metadata and client registration

**Files:**
- Create: `server/mcp/oauth.ts`, `server/mcp/oauth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/oauth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/oauth.test.ts`
Expected: FAIL with `Failed to load url ./oauth.js`.

- [ ] **Step 3: Create `server/mcp/oauth.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests and the types**

Run: `npx vitest run server/mcp/oauth.test.ts`
Expected: PASS, 7 tests.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/mcp/oauth.ts server/mcp/oauth.test.ts
git commit -q -F - <<'MSG'
Serve OAuth metadata and stateless client registration

RFC 9728 and RFC 8414 metadata, and RFC 7591 registration whose client
id is a sealed copy of the redirect URIs. Only https redirects, or http
on localhost for Claude Code, are accepted.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 10: Authorize: the sign-in page and its POST

**Files:**
- Modify: `server/mcp/oauth.ts`, `server/mcp/oauth.test.ts`

- [ ] **Step 1: Write the failing tests**

In `server/mcp/oauth.test.ts`, replace everything above `describe('metadata', () => {` with:

```ts
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
```

Then append at the end of the file:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/oauth.test.ts`
Expected: FAIL with `pkceChallenge is not a function` / `authorizeHandler is not a function` in the authorize tests; the seven earlier tests still pass.

- [ ] **Step 3: Widen the imports of `server/mcp/oauth.ts`**

Replace the three import lines at the top with:

```ts
import { createHash } from 'node:crypto';
import { getPublicOrigin } from 'mcp-handler';
import { seal, unseal } from './seal.js';
import { FirebaseAuthError, signInWithPassword, type FetchLike } from './firebaseAuth.js';
import { createFirestore } from './firestore.js';
import { getProfile } from './limi.js';
import { renderErrorPage, renderSignInPage, type SignInFields } from './signInPage.js';
```

- [ ] **Step 4: Append the authorization section**

Append at the end of `server/mcp/oauth.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests and the types**

Run: `npx vitest run server/mcp/oauth.test.ts`
Expected: PASS, 14 tests, among them "refuses an unregistered redirect_uri without redirecting", "re-renders with the error on a bad password" and "refuses a good password with no Limi profile".

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add server/mcp/oauth.ts server/mcp/oauth.test.ts
git commit -q -F - <<'MSG'
Sign in to Limi on the OAuth authorize page

The POST signs in with Firebase, requires a users/{uid} profile, and
returns to the registered redirect with a sealed five-minute code bound
to the client, the redirect and the PKCE challenge.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 11: The token endpoint

**Files:**
- Modify: `server/mcp/oauth.ts`, `server/mcp/oauth.test.ts`

- [ ] **Step 1: Write the failing tests**

In `server/mcp/oauth.test.ts`, replace everything above `describe('metadata', () => {` with:

```ts
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
```

Then append at the end of the file:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/oauth.test.ts`
Expected: FAIL with `tokenHandler is not a function` / `createOAuth is not a function` in the new tests; the fourteen earlier tests still pass.

- [ ] **Step 3: Widen the imports of `server/mcp/oauth.ts`**

Replace the import lines at the top with:

```ts
import { createHash } from 'node:crypto';
import { getPublicOrigin } from 'mcp-handler';
import { notConfigured, readEnv } from './env.js';
import { seal, unseal } from './seal.js';
import { exchangeRefreshToken, FirebaseAuthError, signInWithPassword, type FetchLike } from './firebaseAuth.js';
import { createFirestore } from './firestore.js';
import { getProfile } from './limi.js';
import { renderErrorPage, renderSignInPage, type SignInFields } from './signInPage.js';
```

- [ ] **Step 4: Append the token section and the wiring**

Append at the end of `server/mcp/oauth.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests and the types**

Run: `npx vitest run server/mcp/oauth.test.ts`
Expected: PASS, 22 tests. The PKCE, expiry, `client_id`, `redirect_uri` and refresh cases each pass.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add server/mcp/oauth.ts server/mcp/oauth.test.ts
git commit -q -F - <<'MSG'
Exchange codes and refresh tokens for connector tokens

The code grant checks PKCE S256, the expiry, the client and the
redirect. Refreshing re-checks the Firebase sign-in, so a changed
password ends the connection. Tokens are bound to this deployment's
/mcp.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 12: The MCP endpoint

**Files:**
- Create: `server/mcp/server.ts`, `server/mcp/server.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/mcp/server.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run server/mcp/server.test.ts`
Expected: FAIL with `Failed to load url ./server.js`.

- [ ] **Step 3: Create `server/mcp/server.ts`**

```ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { notConfigured, readEnv } from './env.js';
import { unseal } from './seal.js';
import { createIdTokenCache, FirebaseAuthError, type FetchLike } from './firebaseAuth.js';
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

  async function verifyToken(req: Request, bearer?: string): Promise<AuthInfo | undefined> {
    const grant = await unseal<GrantClaims>(key, 'access', bearer, { audience: resourceUrl(req), now: now() });
    if (!grant) return undefined;
    try {
      const { idToken } = await idTokenFor(grant.rt, now());
      return { token: bearer!, clientId: grant.cid, scopes: [], extra: { uid: grant.uid, idToken } satisfies LimiAuth };
    } catch (err) {
      if (err instanceof FirebaseAuthError) return undefined;
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
              destructiveHint: false,
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

  return withMcpAuth(mcp, verifyToken, { required: true, resourceMetadataPath: PROTECTED_RESOURCE_PATH });
}
```

- [ ] **Step 4: Run the tests and the types**

Run: `npx vitest run server/mcp/server.test.ts`
Expected: PASS, 9 tests. A 401 carries `resource_metadata="https://limi.example/.well-known/oauth-protected-resource/mcp"`.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/mcp/server.ts server/mcp/server.test.ts
git commit -q -F - <<'MSG'
Serve the Limi tools at /mcp behind the connector token

Stateless Streamable HTTP through mcp-handler. A missing, expired or
foreign token, or a revoked Firebase sign-in, gets a 401 pointing at the
resource metadata, so Claude signs in again.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 13: Vercel adapters and routing

**Files:**
- Create: `api/mcp.ts`, `api/oauth/register.ts`, `api/oauth/authorize.ts`, `api/oauth/token.ts`, `api/well-known/oauth-protected-resource.ts`, `api/well-known/oauth-authorization-server.ts`, `server/mcp/layout.test.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write the failing test**

Create `server/mcp/layout.test.ts`:

```ts
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

  it('sends everything else to the app, except api/', () => {
    expect(destinationOf('/content')).toBe('/index.html');
    expect(destinationOf('/api/unknown')).toBeUndefined();
  });

  it('points every rewrite at a function that exists', () => {
    for (const { destination } of config.rewrites.filter((r) => r.destination.startsWith('/api/'))) {
      expect(apiFiles).toContain(`${destination.slice(1)}.ts`);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run server/mcp/layout.test.ts`
Expected: FAIL with `ENOENT: no such file or directory, scandir` on `api`.

- [ ] **Step 3: Create the adapters**

`api/mcp.ts`:

```ts
// Vercel function for /mcp (see vercel.json). Logic lives in server/mcp.
import { createMcpEndpoint } from '../server/mcp/server.js';

const handle = createMcpEndpoint();

export default { fetch: (request: Request) => handle(request) };
```

`api/oauth/register.ts`:

```ts
// Vercel function for /oauth/register (see vercel.json). Logic lives in server/mcp.
import { createOAuth } from '../../server/mcp/oauth.js';

const oauth = createOAuth();

export default { fetch: (request: Request) => oauth.register(request) };
```

`api/oauth/authorize.ts`:

```ts
// Vercel function for /oauth/authorize (see vercel.json). Logic lives in server/mcp.
import { createOAuth } from '../../server/mcp/oauth.js';

const oauth = createOAuth();

export default { fetch: (request: Request) => oauth.authorize(request) };
```

`api/oauth/token.ts`:

```ts
// Vercel function for /oauth/token (see vercel.json). Logic lives in server/mcp.
import { createOAuth } from '../../server/mcp/oauth.js';

const oauth = createOAuth();

export default { fetch: (request: Request) => oauth.token(request) };
```

`api/well-known/oauth-protected-resource.ts`:

```ts
// Vercel function for /.well-known/oauth-protected-resource[/mcp] (see vercel.json).
import { protectedResourceMetadata } from '../../server/mcp/oauth.js';

export default { fetch: (request: Request) => protectedResourceMetadata(request) };
```

`api/well-known/oauth-authorization-server.ts`:

```ts
// Vercel function for /.well-known/oauth-authorization-server (see vercel.json).
import { authorizationServerMetadata } from '../../server/mcp/oauth.js';

export default { fetch: (request: Request) => authorizationServerMetadata(request) };
```

- [ ] **Step 4: Replace `vercel.json`**

Rewrites run in order after the filesystem. The connector paths come first, and the SPA catch-all no longer matches `api/`, so an unknown `/api/…` is a 404 rather than the app. `/.well-known/oauth-protected-resource/mcp` is the RFC 9728 path-suffixed form, the one the 401 names.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/mcp", "destination": "/api/mcp" },
    { "source": "/oauth/register", "destination": "/api/oauth/register" },
    { "source": "/oauth/authorize", "destination": "/api/oauth/authorize" },
    { "source": "/oauth/token", "destination": "/api/oauth/token" },
    { "source": "/.well-known/oauth-protected-resource", "destination": "/api/well-known/oauth-protected-resource" },
    { "source": "/.well-known/oauth-protected-resource/mcp", "destination": "/api/well-known/oauth-protected-resource" },
    { "source": "/.well-known/oauth-authorization-server", "destination": "/api/well-known/oauth-authorization-server" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/mcp.ts": { "maxDuration": 30 }
  }
}
```

- [ ] **Step 5: Run the test, the types and the suite**

Run: `npx vitest run server/mcp/layout.test.ts`
Expected: PASS, 4 tests.

Run: `npx tsc -p tsconfig.server.json`
Expected: no output.

Run: `npm test`
Expected: 741 tests pass.

- [ ] **Step 6: Commit**

```bash
git add api vercel.json server/mcp/layout.test.ts
git commit -q -F - <<'MSG'
Route /mcp, /oauth and the OAuth metadata to Vercel functions

Thin adapters in api/, with the logic in server/mcp. The SPA catch-all
now skips api/, so an unknown API path is a 404 rather than the app.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 14: Final checks

- [ ] **Step 1: Run the suite, both type-checks and the build**

Run: `npm test`, `npx tsc --noEmit`, `npx tsc -p tsconfig.server.json`, `npm run build`.
Expected:
- 741 tests pass (599 before plus 142);
- both `tsc` runs print nothing;
- the build succeeds.

- [ ] **Step 2: Load the functions under plain Node ESM**

Vitest resolves imports more leniently than Node does. Compile the server the way Vercel does (per file, unbundled) into a folder under `node_modules/`, which git ignores and whose parent `node_modules` supplies the packages. Then load the adapters with Node.

```bash
npx tsc -p tsconfig.server.json --noEmit false --outDir node_modules/.cache/limi-mcp-smoke --rootDir .
echo '{"type":"module"}' > node_modules/.cache/limi-mcp-smoke/package.json
node --input-type=module -e "
const { pathToFileURL } = await import('node:url');
const base = pathToFileURL(process.cwd() + '/node_modules/.cache/limi-mcp-smoke/').href;
process.env.MCP_TOKEN_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.VITE_FIREBASE_API_KEY = 'smoke';
process.env.VITE_FIREBASE_PROJECT_ID = 'smoke';
const as = await import(base + 'api/well-known/oauth-authorization-server.js');
const r1 = await as.default.fetch(new Request('https://smoke.example/.well-known/oauth-authorization-server'));
console.log('metadata', r1.status, (await r1.json()).issuer);
const mcp = await import(base + 'api/mcp.js');
const r2 = await mcp.default.fetch(new Request('https://smoke.example/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' }));
console.log('mcp', r2.status, r2.headers.get('www-authenticate'));
const reg = await import(base + 'api/oauth/register.js');
const r3 = await reg.default.fetch(new Request('https://smoke.example/oauth/register', { method: 'POST', body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] }) }));
console.log('register', r3.status, 'TZ', process.env.TZ);
"
```

Expected, with no `ERR_MODULE_NOT_FOUND` and no network access (none of these calls reach Google):

```
metadata 200 https://smoke.example
mcp 401 Bearer error="invalid_token", error_description="No authorization provided", resource_metadata="https://smoke.example/.well-known/oauth-protected-resource/mcp"
register 201 TZ Asia/Kathmandu
```

- [ ] **Step 3: Confirm the tree is clean**

Run: `git status --short`
Expected: no output. The smoke build sits under `node_modules/`, which is ignored.

---

### Task 15: Deploy and connect (controller, needs the user's go-ahead)

The controller does this task, not a subagent, and only after the user says go. Each step changes something outside the repo. Ask before each numbered group, and stop if the user declines one.

- [ ] **Step 1: Link the Vercel CLI (the user clicks Confirm)**

The repo has no `.vercel/` folder yet. Run `npx vercel@latest login`; the user clicks **Confirm** on the page it opens. Then run `npx vercel@latest link` and choose the existing project, `limi-content-management`. `link` adds `.vercel` to `.gitignore`. Commit that one line if it appears, with a message on stdin as above.

- [ ] **Step 2: Check the Firebase settings are already there**

Run: `npx vercel@latest env ls`
Expected: `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` are listed for Production and Preview. If either is missing, stop and tell the user.

- [ ] **Step 3: Add `MCP_TOKEN_SECRET` (the user's go-ahead)**

The secret is generated into a shell variable and piped in, so it never appears in output or in a file:

```bash
SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
printf '%s' "$SECRET" | npx vercel@latest env add MCP_TOKEN_SECRET production
printf '%s' "$SECRET" | npx vercel@latest env add MCP_TOKEN_SECRET preview
unset SECRET
```

If the preview `add` asks for a Git branch, leave it empty, which applies the secret to every preview branch. Production and Preview may share the value: tokens are sealed for one deployment's `/mcp` and are refused anywhere else.

- [ ] **Step 4: Push and check the preview**

Run: `git push origin claude/gifted-goldberg-3yf5wj`. Vercel builds a preview; find its URL with `npx vercel@latest ls`.

Run: `npx vercel@latest curl /.well-known/oauth-authorization-server --deployment <preview-url>`
Expected: JSON whose `issuer` is the preview origin. (`vercel curl` passes Vercel's deployment protection. Claude cannot, so the connection itself is tested on production.)

Run: `npx vercel@latest logs --deployment <preview-url> --level error --limit 50`
Expected: no function errors.

- [ ] **Step 5: Promote to production (the user's go-ahead)**

With the user's explicit go-ahead: `npx vercel@latest promote <preview-url>`, which builds the preview again as production, with production's variables. Then:

```bash
curl -s https://<production-domain>/.well-known/oauth-protected-resource/mcp
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<production-domain>/mcp
```

Expected: the metadata names `https://<production-domain>/mcp` as `resource`, and the POST answers `401`.

- [ ] **Step 6: Connect Claude Code (the user signs in)**

Run: `claude mcp add --transport http limi https://<production-domain>/mcp`. In Claude Code, `/mcp` lists `limi` as needing authentication; choosing it opens the sign-in page, and the user signs in with their Limi email and password.

Then call `whoami`, `list_clients` and `get_today`, and compare them with what the app shows that user.

Only with the user's go-ahead, make one harmless write: `add_comment` on a test post the user names. Check that the comment appears in the app's thread.

- [ ] **Step 7: Connect Claude.ai (the user pastes and signs in)**

Copy `https://<production-domain>/mcp` to the clipboard (`printf '%s' 'https://<production-domain>/mcp' | clip`), and open Claude.ai → Settings → Connectors → Add custom connector. The user pastes the URL and signs in on the Limi page. The connector then works in Claude.ai on the web and on phones, and in the desktop app.

If Claude.ai reports a registration or sign-in error, check `npx vercel@latest logs --environment production --level error --since 15m`. If it wanted Client ID Metadata Documents rather than dynamic registration (deviation 10), tell the user and stop; supporting CIMD is a follow-up.
