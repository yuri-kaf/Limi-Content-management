# AI review assistant

Date: 2026-10-04
Status: approved in brainstorming

## Context

Sub-project 4 of four, and it depends on the client portal (sub-project 3). The
user asked for a free AI chat for clients. In their example, a client asks "is
there any content we need to review", gets clickable cards back, then says
"approve it but leave feedback to lower the music". They asked for it only if
it was achievable.

Decisions taken with the user:

- **Provider: Google's Gemini API free tier, with an API key.**
  - Chosen over Vercel AI Gateway with no key, a phrase-matching helper with no
    AI, and skipping the assistant.
  - The user creates the key and adds it to Vercel themselves; nobody else
    handles it. Setup is under "Setup".
  - The user accepted that Google may use free-tier prompts to improve its
    products. What is sent is kept to a minimum; see "Privacy".
- **Proposed actions need a Confirm tap.** The assistant never changes anything
  by itself.
- **Clients only**, inside the portal.

## Architecture

```
AssistantPanel (browser, client login)
  │  POST /api/assistant   Authorization: Bearer <Firebase ID token>
  │  { messages, items, today }
  ▼
api/assistant.ts  (Vercel Function, Node)
  1. GEMINI_API_KEY set?                     no  → 503 not-configured
  2. verify the Firebase ID token (jose)     bad → 401
  3. validate the request body               bad → 400
  4. Gemini generateContent, JSON schema     429 → 429 busy, other → 502
  5. parse + validate the model's JSON       bad → 502
  ▼
{ reply, show: [ref], actions: [{ kind, ref, note }] }
  ▼
Panel shows the reply, post cards for `show`, a confirm card for `actions`.
Confirm → updateClientReview(), the same call the portal's buttons make.
```

- **No server-side database access.** There is no service account and there are
  no new security rules. The function only turns language into a structured
  proposal.
- **The browser makes every write as the signed-in client.** The rules still
  let a client change only `clientReview` and `reviewNote`, on their own clients.

## Code layout

| File | Role |
| --- | --- |
| `src/assistant/protocol.ts` | Shared, pure, no imports: types, limits, the response schema, request validation, reply parsing. Used by the server and the browser. |
| `server/assistant.ts` | `createAssistantHandler({ apiKey, model, verifyToken, fetch })`: the testable request → response logic, including the Gemini call. |
| `server/firebaseToken.ts` | `verifyFirebaseToken(token, projectId)` with `jose`, using Google's securetoken JWKS. |
| `api/assistant.ts` | A thin Vercel adapter: reads env and exports `POST`. Nothing else lives in `api/`, because every file there is deployed as a function — tests included. |
| `src/assistant/client.ts` | `askAssistant(request, getIdToken)`: fetch, then map HTTP status to an `AssistantError` code. |
| `src/assistant/useAssistant.ts` | Conversation state, stable refs, building the item list. |
| `src/components/assistant/AssistantButton.tsx`, `AssistantPanel.tsx` | UI. |

Imports in `api/` and `server/` use explicit `.js` extensions. The package is
`"type": "module"`, and Node's ESM loader needs them. TypeScript and Vite both
map `.js` to the `.ts` source.

## Protocol

```ts
interface AssistantItem {
  ref: string;            // "p1", "p2"… — never a Firestore id
  title: string;          // ≤ 200 chars
  stage: 'review' | 'to-post' | 'posted';
  review: 'pending' | 'approved' | 'changes-requested';
  business?: string;      // only when the login sees two or more businesses
  campaign?: string;
  scheduled?: string;     // 'YYYY-MM-DD', local
}
interface AssistantMessage { role: 'user' | 'assistant'; text: string; refs?: string[] }
interface AssistantRequest { messages: AssistantMessage[]; items: AssistantItem[]; today: string }
interface AssistantAction { kind: 'approve' | 'request_changes'; ref: string; note?: string }
interface AssistantReply { reply: string; show: string[]; actions: AssistantAction[] }
```

### Limits

Checked by `validateRequest`; anything over them gets a 400:

- at most 200 items and 16 messages;
- a message up to 1,000 characters, a title up to 200;
- the body up to 64 KB.

### Refs

`useAssistant` gives each post a ref the first time it is sent (`p1`, `p2`…)
and keeps it for the session. "The second one" therefore still means the same
post after the data refreshes.

### Which posts are sent

- All visible posts in review, changes requested or coming up.
- The latest 20 posted.

Editing never reaches the portal, so it is never sent.

### `parseReply`

Run on the server and run again in the browser:

- It drops refs it was not sent, and de-duplicates and caps `show` at 8.
- It keeps an action only if its ref is in Review: a client can act only while
  a post sits in Review, the rule the portal enforces. A dropped action is
  reported in the reply ("That post isn't waiting for your review").
- It trims notes and caps them at 500 characters, and caps actions at 10.

## Gemini call

- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`,
  with the key in the `x-goog-api-key` header.
- **Model:** `GEMINI_MODEL`, defaulting to `gemini-3.5-flash-lite`, a free-tier
  Flash-Lite model.
- **`generationConfig`:** temperature 0.2, `maxOutputTokens` 800,
  `responseMimeType: application/json` and a `responseSchema` for
  `AssistantReply`, with `kind` an enum.
- **`systemInstruction`:**
  - You are Limi's review assistant, for a client of a social media agency.
  - You can answer questions about the listed posts, show posts by ref, and
    propose approve or request-changes decisions with a note. You cannot edit
    posts, dates or anything else; say so plainly.
  - Use only the refs listed, and never invent posts.
  - "It", "that one" or "the second one" refer to posts shown earlier in the
    conversation. If it is ambiguous, ask which one, show the candidates, and
    propose nothing.
  - Write a note as a short, clear instruction to the team, in the client's
    words where possible.
  - Reply in one to three short sentences, in the language the client wrote in.
  - The prompt includes today's date (with weekday) and the posts, as JSON.
- **Conversation:** earlier assistant turns are replayed as `model` turns
  holding their JSON, so the model sees its own refs.
- **Timeout:** 20 seconds. `vercel.json` sets `maxDuration: 30` for the function.

## The panel

- **Button:** an "Ask Limi" pill, bottom-right on every portal page; on phones
  it sits above the bottom bar. Only a client login sees it.
- **Layout:** a 400px right drawer on desktop, a full-screen sheet on phones.
  - The header holds "New chat" and Close.
  - The footer is a text box: Enter sends, Shift+Enter adds a line.
  - One line under it reads: "Answers come from Google Gemini. Only post
    titles, stages and dates are shared."
- **Empty state:** three suggestion chips — "What needs my review?", "What's
  going out this week?", "Show posts with changes requested".
- **Assistant message:**
  - The reply text, plain with line breaks.
  - Compact post cards (thumbnail, title, stage, business or campaign). A card
    opens `/content?item=…&client=…`, and the portal's detail view opens over
    the page; on phones the panel closes first.
- **Confirm card:**
  - Lists each action: Approve "Momo reel", note: "Lower the music".
  - On **Confirm**, the actions run in order through the same review call as
    the portal's buttons. Each line then shows done, failed, or "no longer
    waiting for your review". The last case is re-checked at confirm time
    against live data.
  - **Cancel** marks the card cancelled.
  - A settled card cannot be confirmed twice.
- **History:** kept in memory for the session only. Sending is disabled while a
  reply is pending.

### Error messages

Shown inline as a quiet system line:

| Code | Cause | Message |
| --- | --- | --- |
| `not-configured` | 503 | "The assistant isn't switched on yet." |
| `busy` | 429 | "The assistant is busy right now. Try again in a minute." |
| `signed-out` | 401 | "Your session expired. Sign in again to use the assistant." |
| `unavailable` | network failure, 404, non-JSON | "The assistant isn't available here." This is what local `npm run dev` shows, because Vite does not run Vercel Functions. |
| `failed` | anything else | "Something went wrong. Try asking again." |

## Security

- **Sign-in check.** Without it, anyone could drain the free quota.
  - The ID token is verified with `jose` against
    `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`.
  - Issuer `https://securetoken.google.com/{projectId}`, audience `{projectId}`,
    RS256, and a non-empty `sub`.
  - `projectId` comes from `VITE_FIREBASE_PROJECT_ID`, which Vercel already
    sets for Production and Preview.
- **No role check.** The function has no database access. A signed-in team
  member could call it, but the UI only shows it to clients, and that costs only
  quota.
- **Proposals only.**
  - Post titles reach the model, so a title could try to steer it. The worst
    outcome is a wrong proposal, which a person must confirm.
  - The browser re-validates every ref, and the rules still bound what a client
    can write.
- **The key never reaches the browser,** and error responses never echo it or
  the prompt. Logs record status codes only.

## Privacy

Sent to Google:

- the client's messages;
- for each post: title, stage, review state, scheduled day, and business and
  campaign names.

Never sent:

- captions, hashtags, internal notes, media links, comments, emails, user ids
  or Firestore ids.

## Setup (done by the user)

1. In Google AI Studio (aistudio.google.com, API keys), create an API key.
2. In Vercel, open project `limi-content-management`, then Settings, then
   Environment Variables. Add `GEMINI_API_KEY` for Production and Preview,
   marked Sensitive.
3. Redeploy, or push any commit.
4. Optional: `GEMINI_MODEL`, to pick another free-tier model.

Until then the button still shows, and the panel says the assistant isn't
switched on yet.

## Configuration changes

- **`vercel.json`:**
  - The SPA rewrite becomes `/((?!api/).*)` → `/index.html`, so an unknown
    `/api/…` path is a 404 rather than the app.
  - `functions["api/assistant.ts"].maxDuration` is set to 30.
- **Dependencies:** `jose` added; `@types/node` made an explicit dev
  dependency.
- **`tsconfig.server.json`:** type-checks `api/`, `server/` and
  `src/assistant/protocol.ts` with Node types. The build becomes
  `tsc && tsc -p tsconfig.server.json && vite build`.
- **Vitest:** the existing include picks up `server/*.test.ts`. Those files
  declare `// @vitest-environment node`.

## Testing

- **`protocol.test.ts`:**
  - validation limits;
  - `parseReply` drops unknown refs, keeps actions only for posts in Review,
    trims and caps notes, and caps `show` and actions;
  - schema shape.
- **`server/assistant.test.ts`** (fake `fetch` and `verifyToken`):
  - 405 on GET;
  - 503 without a key;
  - 401 on a bad token;
  - 400 on a bad body;
  - Gemini 429 becomes 429 `busy`;
  - malformed model JSON becomes 502;
  - the success path sends the right URL, header, schema, today's date and
    item JSON — with no caption field;
  - the key never appears in a response body.
- **`server/firebaseToken.test.ts`:** a locally signed JWT against a local JWKS
  checks issuer, audience, expiry and `sub`.
- **`client.test.ts`:** status to error code, and non-JSON to `unavailable`.
- **`useAssistant` / `AssistantPanel`** (fetch mocked):
  - a suggestion chip sends;
  - the reply and cards render;
  - Confirm calls the review action with the mapped arguments;
  - Cancel and settled cards do nothing;
  - an action whose post left Review is skipped and reported;
  - each error code shows its message.

The real end-to-end check needs the user's key, so it happens on the Vercel
preview after setup.

## Non-goals

- An assistant for the team.
- Streaming replies, saved chat history, voice.
- Actions other than review decisions: scheduling, editing, comments.
- Server-side rate limiting beyond Gemini's own free-tier limits.
