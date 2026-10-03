# Businesses, campaigns, and the client workspace

Date: 2026-10-03
Status: proposed

## Context

Opening a client today shows one thing: its content kanban. The agency wants a
client to be a workspace — content is one tab among several — and wants two
new organising concepts:

- **Businesses.** One client (a person or company we bill) can own more than
  one marketing business, e.g. owner A runs business 1 and business 2. Each
  business has its own content.
- **Campaigns.** A named push inside a business that groups the content it
  needs, with a checklist of planned deliverables.

This is sub-project 1 of four, agreed with the user in this order:

1. **Data model + client workspace** (this spec)
2. Visual refresh — pastel stage-coloured cards, macOS-style colourable client
   folders, more motion
3. Client portal — a client-facing Content tab centralising everything across
   businesses and campaigns
4. AI review assistant — chat that lists what needs review and acts on
   "approve this, ask them to lower the music". Planned on a Vercel serverless
   function calling a free LLM tier; depends on 1 and 3.

The folder **colour** field is added here because it is data; the folder
**icon** rendering belongs to sub-project 2.

## Hard constraints (unchanged)

- No backend. Firebase Spark plan, client-side React, hosted on Vercel.
- Role gating is preserved: team (admin, social-media-manager) writes; an
  assigned client reads and may change only `clientReview` / `reviewNote` on
  content.

## Data model

```
clients/{clientId}
  + color?: FolderColor            // folder colour; absent → 'blue'

  businesses/{businessId}           NEW
    name: string
    color: FolderColor
    logoUrl?: string
    about: string
    createdAt: number

  campaigns/{campaignId}            NEW
    businessId: string
    name: string
    brief: string
    status: 'planning' | 'live' | 'completed'
    startDate?: string               // 'YYYY-MM-DD'
    endDate?: string                 // 'YYYY-MM-DD'
    color: FolderColor
    deliverables: Deliverable[]
    createdAt: number

  content/{contentId}
    + businessId: string            // required after migration
    + campaignId?: string
    + deliverableId?: string        // which checklist slot it fills

  ideas/{ideaId}
    + businessId?: string
```

```ts
type FolderColor =
  | 'blue' | 'sky' | 'teal' | 'green' | 'yellow'
  | 'orange' | 'red' | 'pink' | 'purple' | 'graphite';

interface Deliverable {
  id: string;            // stable, generated client-side
  label: string;         // "Reels", "Carousel posts"
  mediaType?: MediaType; // optional hint, pre-fills the add-content form
  target: number;        // how many are planned
}
```

`FolderColor` is a named palette, not a free hex, so every colour is known to
render legibly in both themes. The palette's hex values live in a new module,
`src/folderColors.ts` (`src/palette.ts` is the command palette), with its own
contrast test.

**Deliverable progress is derived, never stored.** Filled count for a
deliverable = content in that campaign whose `deliverableId` matches; "done"
additionally requires `status === 'posted'`. There is no counter to drift.

**Content belongs to at most one campaign**, and a campaign belongs to exactly
one business. Content in a campaign must carry the campaign's `businessId`;
the add/edit form enforces this by deriving business from campaign.

### Deleting

- Deleting a campaign does not delete its content: content has `campaignId`
  and `deliverableId` cleared, in one batched write.
- A business can only be deleted when it holds no content and no campaigns, and
  never the client's last business. The UI explains why the action is disabled.

## Security rules

Add under `match /clients/{clientId}`, mirroring existing patterns:

```
match /businesses/{businessId} {
  allow read: if isAdmin() || isManager() || isAssigned(clientId);
  allow create, update, delete: if isAdmin() || isManager();
}
match /campaigns/{campaignId} {
  allow read: if isAdmin() || isManager() || isAssigned(clientId);
  allow create, update, delete: if isAdmin() || isManager();
}
```

Content rules are unchanged: `onlyReviewFieldsChanged()` already prevents a
client from moving content between businesses or campaigns. A client who owns
several businesses is assigned to the client, so they see all of them.

## Migration

Follows the existing `pendingMigration` / `migrateLegacyContent` pattern in
`src/store.ts`:

- `pendingBusinessMigration`: clients with no business documents, plus
  content items lacking `businessId`.
- `migrateBusinesses()`: for each such client, create one business named after
  the client (inheriting its image and `about`), then batch-write `businessId`
  onto every content item lacking it. Idempotent — reruns skip done work, so a
  partial failure is safe to retry.
- Surfaced to admins as the same kind of banner the earlier migrations used.

Until a client is migrated, its content without `businessId` is treated as
belonging to the client's first business, so nothing disappears in the window
between deploy and migration.

Creating a client creates its first business in the same batch from then on.

## Data access (`src/store.ts`)

- `useBusinesses(clientId)` and `useCampaigns(clientId)` — `onSnapshot` over
  the subcollection, same shape as `useIdeas`. Both are per-client list queries,
  which the rules permit for assigned clients.
- Actions: `addBusiness`, `updateBusiness`, `deleteBusiness`, `addCampaign`,
  `updateCampaign`, `deleteCampaign`, `setClientColor`.
- Content add/update accepts `businessId`, `campaignId`, `deliverableId`.
- Pure helpers in a new `src/campaigns.ts`: `deliverableProgress(campaign,
  content)`, `campaignProgress(...)`, `scopeContent(content, {businessId,
  campaignId})`. These are where the logic lives so they can be unit-tested
  without Firebase.

## Routes

```
/client/:id                        → workspace, default tab
/client/:id/:tab                   → overview | content | campaigns | calendar | ideas
/client/:id/campaign/:campaignId   → campaign page
```

Business scope is a query parameter, `?b=<businessId>`, not a path segment: it
is a filter over the same tabs rather than a different place, and keeping it
in the URL makes it survive refresh and work with back/forward.

## Client workspace

Header: client avatar, name, colour picker (team only), and a menu with
"Add business" and "Edit client". Below it, a tab bar.

| Tab | Contents |
|---|---|
| **Overview** | Business cards (multi-business only, see below); counts by stage; "Needs attention" (awaiting review, declined, overdue schedule); next 7 days of scheduled posts; active campaigns with progress bars. |
| **Content** | The existing kanban, behaviour unchanged. Adds business and campaign filter chips beside the existing `BoardFilters`. Cards show a small campaign label when they belong to one. |
| **Campaigns** | Campaign cards (colour, name, status, dates, progress bar, deliverables summary). "New campaign" opens a form. Grouped Live → Planning → Completed. |
| **Calendar** | The existing `ContentCalendar`, scoped. |
| **Ideas** | The existing `IdeasView`, scoped. |

Default tab is **Content** — it is what people open a client for today, and
changing the landing view at the same time as adding tabs would be two changes
at once. Overview is one click away.

### Single vs multi-business

The business layer is invisible until it is needed.

- **One business:** no business UI anywhere — no cards, no chips, no selector
  in forms. The workspace looks like today plus tabs.
- **Two or more:** Overview opens with a row of business cards (colour,
  logo/initial, name, awaiting-review count, active campaigns). Clicking a card
  sets `?b=` and scopes every tab; a breadcrumb chip shows the scope with an
  "All businesses" clear. Content, Calendar and Ideas also gain a business
  filter chip so the combined view stays available.

Adding a second business turns all of this on with no other change.

### Campaign page

- Header: colour swatch, name, status pill (editable inline by the team), date
  range, overall progress bar, edit / delete in a menu.
- Brief: read-only prose block, editable via the edit form.
- Deliverables checklist: one row per deliverable — `label  ▓▓▓░░  2/3 posted`
  — with each linked content item as a chip that opens the content detail.
  Unlinked slots show a "+ Add" that opens Add Content pre-filled with this
  campaign, the deliverable, and its media type.
- Kanban of this campaign's content only (reuses `KanbanColumn` / `ContentCard`).

### Forms

- **Add/Edit content:** adds Business (hidden with one business) and Campaign
  (optional; choosing one sets business and reveals a Deliverable select).
- **Campaign form:** name, business (hidden with one), status, start/end dates,
  colour, brief, and a deliverables editor (label, media type, target; add /
  remove rows).
- **Business form:** name, colour, logo URL, about.

## Error handling

- Every new write goes through the existing store pattern: optimistic UI is
  not used for structure changes; failures surface through the existing toast /
  inline error, and the snapshot listener remains the source of truth.
- A route naming a campaign or business that does not exist (deleted, or a
  stale link) shows an inline "This campaign no longer exists" with a link back
  to the client, rather than a blank page.
- Content whose `campaignId` points at a deleted campaign (possible if an item
  was filed into the campaign while it was being deleted) is treated as having
  no campaign by `scopeContent`. The stale id is cleared the next time the item
  is edited, because the content form always sends its campaign, or `null`.

## Testing

Vitest, matching existing tests:

- `src/campaigns.test.ts` — deliverable and campaign progress (posted vs
  linked, over-target, empty deliverables), `scopeContent` by business and
  campaign including dangling `campaignId` and pre-migration items without
  `businessId`.
- Migration planning — given clients/content fixtures, the pending list is
  correct and a second pass is empty.
- Component tests: workspace hides all business UI with one business and shows
  cards + chips with two; tab routing reads and writes `:tab` and `?b=`.
- `firestore.rules` changes verified manually against the emulator-free
  checklist used in the auth spec (client can read businesses/campaigns of an
  assigned client, cannot write them, cannot change `campaignId` on content).

## Revisions made while planning

Recorded here so the spec and the plan agree. Details in
`docs/superpowers/plans/2026-10-03-businesses-campaigns-workspace.md`.

1. **Client-role users see Content, Calendar and Ideas only**, exactly the
   views they had. Overview and Campaigns are team-facing until the client
   portal (sub-project 3).
2. **One business-scope control.** A chip bar under the tabs (two or more
   businesses only) sets `?b=` for every tab; Overview's business cards set the
   same parameter. This replaces the separate breadcrumb chip and per-tab
   filter chips described above.
3. **The folder colour is chosen in the client form**, not a header picker. It
   shows immediately on the lettered avatar; sub-project 2 renders the folder
   icon.
4. **The campaign page has Plan and Board views**, not a short kanban under
   the checklist.
5. **Adding a business or a campaign waits for the client's first business**,
   so a business added before the migration cannot become the default and
   absorb the client's existing content.
6. Converting an idea now marks it converted. The old board never called
   `markConverted`, so "Make content" never went away.
7. **Businesses are subscribed for every client inside `useClients()`**, not
   through the per-client `useBusinesses(clientId)` described under Data
   access: the migration banner must see every client's businesses. Cost: one
   more listener per client.
8. **Campaign `startDate`/`endDate` are `'YYYY-MM-DD'` strings**, not
   timestamps. A day has no time zone; a timestamp saved at midnight in
   Kathmandu reads as the day before anywhere west of it.
9. **The first business can never be deleted** — everything without a
   `businessId` belongs to it. Deleting another business moves its ideas to
   the first business in the same batch; content and campaigns still block.
10. **The first business has the fixed id `main`**, so two migration runs at
    once write one document rather than two "first" businesses.
11. **A deliverable's progress is out of `max(target, made)`**, and the
    campaign total sums the same figure, so a deliverable row and its campaign
    never disagree when more were made than planned.

## Non-goals for this sub-project

- Visual restyle, pastel cards, folder icons → sub-project 2.
- Client-facing centralised Content tab → sub-project 3 (this model is shaped
  for it: one per-client content query already spans all businesses).
- AI assistant → sub-project 4.
- Budgets, KPIs, campaign analytics.
- Content in more than one campaign.
