# Client portal

Date: 2026-10-04
Status: approved in brainstorming

## Context

Sub-project 3 of four. Today a client login gets the team's screens with parts
removed:

- **Today**, a queue built for an agency.
- **My Boards**.
- **A per-client workspace** whose Content tab is a kanban the client cannot move.

The user asked for "a content tab in the nav bar where they can review all the
content, either from a campaign or one without a campaign". A client may own
two businesses ("A owns 1 and 2"); the businesses keep separate cards, but "in
the content tab everything should be centralised".

Decisions taken with the user:

- **Client logins get their own portal layout.** Chosen over adding a Content
  page beside the existing boards, and over a review list inside each board.
  The team's screens do not change.
- **Approving can carry a note** ("lower the music a bit"). Declining is
  renamed **Request changes** in every label; the stored value stays `declined`.
- **Campaign briefs stay internal.** Clients see a campaign's name, dates and
  progress, not its brief, in case the team writes notes there.

## Routes and navigation

| Path | Team (admin, SMM) | Client |
| --- | --- | --- |
| `/` | Today | Portal home |
| `/content` | → `/` | Portal content |
| `/calendar` | → `/` | Portal calendar |
| `/ideas` | → `/` | Portal ideas |
| `/clients`, `/client/:id`, `/client/:id/:tab`, `/client/:id/campaign/:cid` | unchanged | → portal (below) |
| `/profile` | unchanged | unchanged |
| `/users` | admin only, unchanged | → `/` |

`AuthenticatedRoutes` picks a route table by role.

Redirects keep old links working:

- `/client/:id?item=X` goes to `/content?item=X&client=:id`.
- Anything else under `/client` or `/clients` goes to `/content`.
- When `client` is absent, an `item` id is looked up across every assigned
  client.

Navigation for a client:

- **Sidebar:** Home, Content, Calendar and Ideas.
  - Content carries a badge with the count of posts awaiting their review.
  - With two or more businesses, a **Businesses** group lists each one as a
    small folder, linking to `/content?b=…`.
  - The footer email links to Profile.
- **Phone bottom bar:** Home, Content, Calendar, Ideas.
- **Search** (`CommandPalette`) indexes the portal pages, the client's
  businesses and the posts the client can see. Posts open
  `/content?item=…&client=…`.

## Portal data — `src/portal.ts` (pure)

A login may be assigned several clients, and each client has one or more
businesses. The portal treats **business** as the unit, across every assigned
client.

- A business id is unique only within its client (every client has a `main`),
  so a portal business key is `` `${clientId}:${businessId}` ``. Campaign keys
  are built the same way.
- `portalBusinesses(clients)`: every business of every assigned client, client
  by client, first business first.
- `portalItems(clients, campaignsByClient)`: every visible post, flattened.
  - Each post carries `clientId`, `businessKey` (via `businessIdOf`) and its
    campaign (via `campaignIdOf`, so a deleted campaign reads as none).
  - Posts still in **Editing are excluded**, as today.
- `sectionOf(item)`:
  - **posted**: `status === 'posted'`.
  - **changes**: otherwise, `clientReview === 'declined'`.
  - **review**: otherwise, in Review with `clientReview === 'pending'`.
  - **upcoming**: everything else — To Post, or approved but not yet moved.
- `portalSections(items)` sorts each section:
  - review and upcoming: by schedule soonest first, unscheduled last, then by
    creation;
  - changes: newest first, by creation (a post stores no decision time);
  - posted: latest schedule (or creation) first.
- `filterPortal(items, { businessKey?, campaignKey? })`. The campaign key may be
  `none`, meaning "no campaign".

A client acts on a post only while it sits in Review — the same rule the
workspace enforces today. Quick actions appear only in the review section. The
detail view also offers changing a decision while the post is still in Review.

### Store

`useCampaignsByClient(clientIds)` opens one `onSnapshot` per client on its
campaigns, the same query as `useCampaigns`, and returns `{ byClient, loading }`.
The rules already allow an assigned client to read campaigns. Campaign labels
fill in when it resolves; it never blocks the page.

## Content page — `/content`

- **Header:** "Content" and a summary ("3 to review · 4 coming up").
- **Filters:**
  - Business chips: "All" plus each business with its small folder, shown only
    with two or more businesses, driven by `?b=`.
  - A campaign select, driven by `?c=`:
    - "All campaigns" and "No campaign";
    - then only the campaigns that have visible posts;
    - grouped by business when there are two or more.
- **Sections**, each with a heading and a count. An empty section is hidden,
  except **Needs your review**, which says "You're all caught up".
  1. **Needs your review**
  2. **Changes requested**: "waiting on your team".
  3. **Coming up**
  4. **Posted**: the latest 12, then "Show all (39)".
- **Card** (`PortalCard`):
  - **Media:** a 16:9 thumbnail, or a type icon on the stage tint when the
    preview fails.
  - **Text:** a stage-tinted body using the sub-project 2 palette, with the
    title clamped to two lines.
  - **Metadata:**
    - the business name, when there are two or more;
    - the campaign as a colour label;
    - the date: "Goes out Oct 7" or "Posted Oct 2";
    - on change requests, "Changes requested" with the start of the note.
  - **Click:** opens the detail view.
- **Quick actions**, on review cards only:
  - **Approve** writes at once, then shows a toast — `Approved "Momo reel"` —
    with **Undo**. Undo restores the previous decision and note, not blindly
    "pending".
  - **Request changes** expands a note box on the card, with **Send** and
    **Cancel**. The note is optional, but the placeholder asks what to change.
- **Grid:** one column on a phone, two from `md`, three from `xl`.
- **Deep links:** `?item=` opens the detail view, as in the workspace.

## Detail view

The portal reuses `ContentDetailModal` with `isClientRole`, through a small
`PortalItemSheet` that wires review and comments to the post's own client.

- **Client side:**
  - **Approve** stays one tap.
  - **Add a note** expands a box, and its button reads **Approve with note**.
  - **Request changes** replaces Decline, and its button reads
    **Send request**.
  - The settled states read "You approved this" or "You asked for changes",
    each with the note.
  - "Reset review" becomes **Undo my decision**.
- **Team side:**
  - The review block reads "Client approved" — with the note, when there is
    one — or "Client asked for changes" with the note.
  - On board cards, an approved post with a note gets a small note icon beside
    "Approved". The note is in its `title` and `aria-label`.

`updateClientReview` writes these system comments, with the note appended as
today:

- "approved this"
- "asked for changes"
- "reset the review", replacing the old "pending this"

Old comments keep their text.

**Renamed copy:** "Declined" becomes "Changes requested" or "asked for changes"
on:

- board badges and the team detail view;
- Today's "Needs rework" hint;
- the dashboard;
- the public review page buttons and outcome.

Ideas keep "Declined": declining an idea is a different act.

## Home — `/`

1. **Greeting:** "Good morning, {first name}", by local hour, with a one-line
   summary: "3 posts need your review" or "You're all caught up".
2. **Needs your review:** up to three cards with quick actions, plus
   "Review all (N)".
3. **Your businesses:** only with two or more. Each is a folder card in the
   business colour, with its logo or initial, the name and
   "2 to review · 1 live campaign". It links to `/content?b=…`.
4. **Campaigns:**
   - Shows planning and live campaigns that have at least one visible post.
   - Each shows its colour label, date range and progress bar: "4 of 9 posted",
     from `campaignProgress`.
   - Each links to `/content?c=…`.
   - Read-only, and no brief.
5. **Coming up:** posts scheduled in the next 7 days, as compact rows that open
   the detail view.

A client with no visible posts sees an empty state explaining that their team
will share posts here for review.

## Calendar and Ideas

- **Calendar** (`/calendar`):
  - `ContentCalendar` over the filtered portal posts, with the same business
    chips.
  - `canAdd` is false.
  - A post opens the detail view.
- **Ideas** (`/ideas`):
  - `IdeasView` with `canTriage` false.
  - With several assigned clients, chips choose the client.
  - With one, it goes straight to that client's ideas.
  - A business chosen with `?b=` scopes the list and files new ideas under it,
    as `IdeasView` already does.

## Toasts

There is no toast system today; writes report failure through `runWrite`'s
alert. A minimal `ToastProvider` and `useToast()` are added:

- one toast at a time;
- bottom-centre, above the phone bottom bar;
- dismissed after five seconds;
- an optional action button;
- announced through `role="status"`.

Failures still go through `runWrite`. The assistant reuses the toasts in
sub-project 4.

## Removed

- `TodayPage`'s client branch, and `todaySources`' client filtering: the portal
  home replaces both.
- The client paths through `ClientsPage` and `ClientWorkspacePage`: clients are
  redirected away from them.

## Security

No rule changes:

- An assigned client already reads content, businesses and campaigns.
- An approval note is `reviewNote`, one of the two fields a client may change.

## Error handling

- Writes go through `runWrite`. The toast appears only after the write resolves,
  so it never claims an approval that failed.
- An unknown `?item=` (deleted, or not visible to this login) opens nothing and
  leaves the page as it is.
- An unknown `?b=` or `?c=` is ignored, as `resolveScope` does in the workspace.

## Testing

- **`portal.test.ts`:**
  - `sectionOf` for every status and review combination;
  - the section sort orders;
  - business and campaign keys across two clients that both have a `main`
    business;
  - Editing excluded;
  - a dangling `campaignId` read as no campaign;
  - filters, including `none`.
- **Routing:**
  - a client is redirected from `/clients` and `/client/:id?item=X`, with the
    item carried;
  - the team's routes are unchanged.
- **`PortalContentPage`** (store and auth mocked, as in the workspace tests):
  - the sections render;
  - business chips appear only with two or more businesses;
  - Approve calls `updateClientReview(clientId, itemId, 'approved')`, and Undo
    restores the previous decision and note;
  - Request changes sends the note.
- **`PortalHomePage`:**
  - greeting and summary;
  - review cards capped at three;
  - business cards only with two or more;
  - campaigns without briefs.
- **`ContentDetailModal`:**
  - approve with a note;
  - the renamed labels;
  - the team view shows an approval note.
- **Navigation and search for a client role:** `nav.test.ts`, `palette.test.ts`.

## Non-goals

- The AI assistant (sub-project 4).
- Notifications or email for clients.
- Clients editing campaigns or seeing briefs.
- A kanban for clients.
- Bulk approve; the assistant covers "approve all three".
