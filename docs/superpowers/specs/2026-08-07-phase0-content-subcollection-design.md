# Phase 0 — Content subcollection migration

**Date:** 2026-08-07
**Status:** awaiting review

## Why

Content items are stored as an array field on each client document. That was adequate for a
status board and is inadequate for everything in the roadmap.

### It loses data today

`updateContent`, `deleteContent`, and `updateContentStatus` in [store.ts](../../../src/store.ts)
read the whole `content` array out of local React state, modify it, and write it back with
`updateDoc`. There is no transaction and no merge. When two people act at the same time —
two managers dragging cards, or a manager editing while a client approves — the second write
overwrites the first with no error surfaced to anyone.

This is a present bug, not a future risk. Symptoms look like items "jumping back" to a
previous column.

### It blocks the roadmap

- **Comments** would rewrite the entire client document per comment, multiplying the race above.
- **1 MB document limit.** Content plus comments plus versions plus captions on one document
  will reach it. It's a wall, not a gradual slowdown.
- **Public review links are impossible.** Sharing one item means granting read access to the
  document containing every item for that client. Rules cannot reach inside an array.
- **Client-role permissions are too broad.** Rules can currently only grant a client update
  access to the whole client document, so a client could rewrite any field. Documented as a
  known limitation in the Firebase Auth design doc; this phase closes it.

## Target model

```
clients/{clientId}                    name, imageUrl, about, createdAt
clients/{clientId}/content/{itemId}   title, driveLink, driveFileId, mediaType,
                                      notes, status, scheduledAt, uploadedByEmail,
                                      clientReview, reviewNote, createdAt
```

Item documents keep their existing `id` value as the document ID, so nothing that references
an item by ID has to change.

## Rules

The subcollection makes per-item permissions expressible for the first time:

```
match /clients/{clientId} {
  allow read:   if isAdmin() || isManager() || isAssigned(clientId);
  allow create, delete, update: if isAdmin() || isManager();

  match /content/{contentId} {
    allow read:   if isAdmin() || isManager() || isAssigned(clientId);
    allow create, delete: if isAdmin() || isManager();
    allow update: if isAdmin() || isManager()
                  || (isAssigned(clientId) && onlyReviewFieldsChanged());
  }
}

function onlyReviewFieldsChanged() {
  return request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['clientReview', 'reviewNote']);
}
```

Two improvements fall out of this:

**Clients are confined to review fields.** They can no longer write anything else on the
record, which was not expressible against an array.

**Client-role list queries work again.** The earlier "rules are not filters" problem forced
client-role users onto per-document reads, because `isAssigned(clientId)` varied per result.
In a subcollection, `clientId` is fixed by the path and only `contentId` varies — and the
rule doesn't depend on `contentId`. So `clients/{id}/content` can be queried normally by an
assigned client, and the per-document workaround can be retired.

## Reading content

`useClients` returns client metadata only. A new `useContent(clientId)` hook subscribes to
one client's content subcollection — this is what the board and calendar use.

The clients list page shows per-client item counts and an aggregate total, which the client
documents no longer carry. Options considered:

1. **Subscribe to each client's content subcollection from the list page.** Accurate, no
   denormalisation to drift out of sync. Costs N subscriptions — trivial at 6 clients.
2. Denormalised counters on the client document. Cheaper at scale, but every write must
   maintain them and they drift when anything goes wrong.
3. A `collectionGroup` query. Needs a composite index and a separate collection-group rule.

**Chosen: option 1.** It is correct by construction at the current scale. Revisit at roughly
50+ clients, at which point option 2 becomes worth its complexity.

## Migration

No service account is available and the Admin SDK can't run here, so migration runs in the
browser as a signed-in admin.

- A one-time admin-only action, shown only when legacy array data is detected.
- **Idempotent**: skips items that already exist in the subcollection, so a re-run after a
  partial failure is safe.
- Writes via `writeBatch` per client.
- **The legacy array is not deleted.** It stays as a rollback path until the subcollection is
  confirmed good in production; removal is a separate follow-up commit.

## Rollout order

1. Deploy code that reads from the subcollection and includes the migration action
2. Sign in as admin, run the migration
3. Verify every board and the calendar against the counts recorded beforehand
4. Later, once confirmed, a follow-up commit drops the legacy array

Between steps 1 and 2 the boards will read empty. The team should be told before this runs;
at this scale the window is under a minute.

## Verification

- `npm run build` passes
- Item counts per client match what was recorded before migrating
- Admin, manager, and client roles each load a board and the calendar
- A client can approve/decline, and **cannot** modify any other field (rules probe)
- Two simultaneous status changes both survive — the bug that motivated this

## Explicitly out of scope

Comments, versions, captions, and provider support. This phase changes where content lives
and nothing else. It should be invisible in the UI, which is what makes it verifiable.
