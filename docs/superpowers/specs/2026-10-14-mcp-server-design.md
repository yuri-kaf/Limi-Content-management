# Limi MCP server

Date: 2026-10-14
Status: approved in brainstorming

## Context

The user wants to drive Limi from Claude: Claude.ai on web and phone, the
Claude desktop app, and Claude Code. Example requests:

- "What's overdue for Shopit?"
- "Move the Momo reel to Review and tell them it's ready."
- "Add five Tihar ideas for Everest IT."

The user is non-technical and wants no manual setup beyond signing in and
confirming.

Decisions taken with the user:

- **Remote server on the existing Vercel project**, at `/mcp`. A server that
  runs only on this PC was rejected because it would not reach Claude.ai.
- **Claude acts as the signed-in person.** The server never holds an admin or
  service-account key. Every read and write goes through the Firestore REST API
  with that person's own Firebase ID token. The existing `firestore.rules`
  therefore decide what Claude may see and change, exactly as in the app. A
  service-account design was rejected: it bypasses the rules, so any bug in the
  server's own permission checks would expose every client.
- **Anyone with a Limi login may connect**, whether admin, social media manager
  or client. The rules scope each of them.
- **Tools never delete anything** and never touch users, roles or shares.

## Architecture

```
Claude (connector)
  │ OAuth 2.1 + PKCE, dynamic client registration
  ▼
Vercel functions (Node 20)
  /.well-known/oauth-protected-resource      metadata
  /.well-known/oauth-authorization-server    metadata
  /oauth/register    stateless DCR: client_id is a signed blob of redirect_uris
  /oauth/authorize   GET: Limi sign-in page. POST: email + password
                     → Firebase Auth REST signInWithPassword
                     → users/{uid} profile must exist
                     → code = sealed {firebaseRefreshToken, uid, client_id,
                       redirect_uri, code_challenge}, valid 5 minutes
  /oauth/token       authorization_code (PKCE S256) | refresh_token grants
                     → access token: sealed {firebaseRefreshToken, uid}, 1 hour
                     → refresh token: the same, 90 days
  /mcp               MCP Streamable HTTP, stateless, bearer = access token
                     → unseal, exchange the Firebase refresh token for an ID
                       token (securetoken API, cached per warm instance until
                       5 minutes before expiry)
                     → tools call Firestore REST with that ID token
```

- **Sealing:** JWE (`dir` + `A256GCM`, via `jose`), keyed by the
  `MCP_TOKEN_SECRET` environment variable, which holds 32 random bytes in
  base64. There is no token database; everything the server needs travels
  inside the sealed token.
- **Revocation comes for free:**
  - Removing someone on the Team page deletes their profile, so the rules deny
    everything they try.
  - Changing a password revokes their Firebase refresh tokens, so the next
    exchange fails and Claude asks them to sign in again.
- **Libraries:** `mcp-handler` (Vercel's adapter over
  `@modelcontextprotocol/sdk`) for `/mcp`, and `jose`. Firebase is called over
  plain REST with `fetch`; there is no `firebase-admin`.
- **Time zone:** the team works in Asia/Kathmandu (UTC+5:45). The server sets
  `process.env.TZ = 'Asia/Kathmandu'` at module load, so the shared day-based
  helpers (`isLate`, `isDueWithin`, `buildToday`) read days the way the app
  does. Dates given to tools are read as Kathmandu local time. Returned dates
  carry both ISO and a readable Kathmandu form.
- **Routing:** `vercel.json` rewrites `/mcp`, `/oauth/*` and
  `/.well-known/oauth-*` to their functions, ahead of the SPA catch-all. The
  catch-all stops matching `api/`.

## Code layout

| File | Role |
| --- | --- |
| `server/mcp/seal.ts` | Seal and unseal the sealed blobs with an expiry. |
| `server/mcp/firebaseAuth.ts` | `signInWithPassword` and `exchangeRefreshToken` over REST, with an injectable `fetch`. |
| `server/mcp/firestore.ts` | A small Firestore REST client: get, list, query, create, and patch with `updateMask`, plus value encoding and decoding. Takes an ID token. |
| `server/mcp/oauth.ts` | Metadata, register, authorize (the HTML page and the POST), and token handlers, as pure request → response functions. |
| `server/mcp/limi.ts` | A data layer over `firestore.ts`, mirroring `src/store.ts`: profile, clients, content, comments, campaigns, ideas, and the writes, including system comments. |
| `server/mcp/tools.ts` | Tool definitions (zod schemas, descriptions) calling `limi.ts`. |
| `api/mcp.ts`, `api/oauth/*.ts`, `api/well-known/*.ts` | Thin Vercel adapters only. Every file in `api/` is deployed, so no tests live there. |

Pure helpers are imported from `src/`, never copied: `getMediaInfo`,
`businessIdOf`, `campaignIdOf`, `isLate`, `isDueWithin`, `buildToday`,
`STAGES`. None of these import Firebase.

## Tools

Read:

| Tool | Does |
| --- | --- |
| `whoami` | Name, email, role and the clients this login can see. |
| `list_clients` | Clients with their businesses and counts per stage. |
| `list_content` | Filters: client, business, campaign, stage, `when` (`overdue`, `today`, `next7`, `next31`, `unscheduled`), `needs_review`, and a text search over the title and caption. Capped at 50, with a total count. |
| `get_content` | One post: every field, its versions and its comment thread. |
| `get_today` | The Today queue: needs review, needs rework, going out soon, overdue. |
| `list_campaigns` | Per client: status, dates and progress (posted of planned). Clients do not see briefs; the portal spec applies the same rule. |
| `list_ideas` | Per client, filterable by status. |

Write. Each tool states in its description that it changes data, so Claude
asks for confirmation:

| Tool | Does | Mirrors |
| --- | --- | --- |
| `create_content` | Title, client, business, stage (default Editing), schedule, caption, hashtags, platforms, Drive link (media info via `getMediaInfo`), campaign. | `addContent` |
| `update_content` | Any of title, schedule, caption, hashtags, platforms, notes, link. A changed link appends a version and writes "uploaded vN". | `updateContent` |
| `move_content` | Changes the stage and writes the system comment "moved this to X". | `updateContentStatus` |
| `review_content` | `approved`, `declined` or `pending`, with an optional note. Writes the system comment. | `updateClientReview` |
| `add_comment` | A user comment, optionally at a video timestamp in seconds. | `addComment` |
| `add_idea` | Title, description, links, business. | `addIdea` |

A write the rules refuse returns a plain message, "Your Limi role can't do
that", never a stack trace. Clients can, in practice, review, comment and add
ideas.

## The sign-in page

- One small server-rendered HTML page using the Limi logo, the light and dark
  colour tokens, and the Inter font.
- It contains: "Connect Claude to Limi", the email and password fields, and a
  line naming what Claude will be able to do.
- A wrong password shows Firebase's message on the same page. Firebase's own
  throttling rate-limits attempts.
- The page is never framed (`X-Frame-Options: DENY`). The `redirect_uri` must
  match the one registered.

## Setup (done by Claude, except where marked)

1. Generate `MCP_TOKEN_SECRET` and add it to the Vercel project for Production
   and Preview with the Vercel CLI. **The user clicks Confirm** on the Vercel
   CLI sign-in page in their browser.
2. Deploy by pushing the branch, and promote to production with the user's
   go-ahead.
3. Claude Code: `claude mcp add --transport http limi https://<domain>/mcp`.
   **The user signs in** on the page that opens.
4. Claude.ai: Claude opens Settings → Connectors with the URL on the
   clipboard. **The user pastes it** and signs in.

## Error handling

- An expired or invalid access token returns 401 with `WWW-Authenticate`
  pointing at the resource metadata, so Claude re-runs the sign-in.
- Firebase refresh failures (password changed, account disabled) are treated
  the same as 401.
- Firestore 403 becomes "Your Limi role can't do that." 404 becomes "No such
  post (or you can't see it)."
- The `MCP_TOKEN_SECRET` variable missing → 503 with a plain message.

## Testing

All tests run under Vitest with a fake `fetch`. Nothing touches live Firebase.

- **`seal`:** round trip; expired; tampered; wrong key.
- **`oauth`:**
  - metadata shape;
  - DCR round trip;
  - authorize rejects an unregistered `redirect_uri`;
  - the POST with a bad password re-renders with the error;
  - a good password with no profile is refused;
  - the code exchange checks PKCE (a wrong verifier fails), the expiry, the
    `client_id` and the `redirect_uri`;
  - the refresh grant works.
- **`firestore`:** value encoding and decoding for strings, numbers, arrays,
  maps and nulls; the `updateMask` is built from the fields that changed.
- **`limi` and tools:**
  - each tool's happy path against a fake Firestore REST;
  - a client login enumerates only its `assignedClientIds`;
  - a 403 from Firestore becomes the plain message;
  - `move_content` writes the status and then the system comment;
  - `update_content` with a new link appends a version.
- **Rules:** the rules are unchanged, so no new rules tests are needed.
- **End-to-end after deploy:** connect Claude Code, run `whoami`,
  `list_clients`, `get_today` and one harmless write. Comment on a test post
  only with the user's go-ahead.

## Non-goals

- Deleting anything; managing users, roles or shares; publishing to social
  networks (a separate sub-project).
- Push notifications or webhooks to Claude.
- Signing in with Google; Limi uses email and password.
