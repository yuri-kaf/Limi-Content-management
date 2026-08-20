# UI redesign: Notion-register shell, validated token system, and view modes

Date: 2026-08-20
Status: proposed

## Goal

Rebuild the entire UI layer as a modern SaaS product in Notion's register: a
persistent sidebar you navigate *within* rather than a top bar you navigate
*back* through, near-monochrome surfaces where colour signals state rather than
decorating, light by default with a real dark theme, and — the part that makes
this more than a repaint — the same content reachable through more than one
view.

Two decisions were taken with the user before this spec:

- **Shell: persistent left sidebar** (option A of three). Deletes the desktop
  top bar, the mobile bottom bar, the Kanban/Calendar/Ideas pill switcher, and
  the "All Clients" back button. One navigation tree replaces four mechanisms.
- **Visual language: Notion-faithful** (option A of three). Warm near-black ink
  on white, hairline borders, no card shadows, 4px radii, stages as soft tinted
  labels, red reserved for the primary action.

Beyond that the user delegated design authority explicitly, with the standing
instruction that decisions must make the system *genuinely* better rather than
merely different.

## Non-goals

- No data model changes. Firestore collections, security rules and the share
  mechanism stay exactly as they are.
- No server. Every capability below is client-side over data already
  subscribed.
- No change to who may do what. Role gating is preserved as-is.

## Current state, measured

4,114 lines of UI across 18 files. **261 hardcoded hex colours** in 10 files
bypass the token system entirely; the other 7 files are already fully
tokenised and will restyle for free when tokens change.

| File | Hardcoded colours |
| --- | --- |
| `pages/ClientBoardPage.tsx` | 59 |
| `components/IdeasView.tsx` | 48 |
| `pages/PublicReviewPage.tsx` | 38 |
| `components/ContentCard.tsx` | 21 |
| `components/ContentCalendar.tsx` | 16 |
| `components/ClientCard.tsx` | 15 |
| `pages/ClientsPage.tsx` | 14 |
| `components/KanbanColumn.tsx` | 12 |
| `components/NotifPermissionBanner.tsx` | 10 |
| `components/BottomNav.tsx` | 6 |

Already token-clean: `ContentDetailModal`, `AddContentModal`, `AddClientModal`,
`CommentThread`, `Dashboard`, `LoginPage`, `UserManagementPage`.

`ThemeContext` currently defaults to `'dark'`, which is why the app is not
white on first load.

## Design system

### Palette

Every value below was computed, not eyeballed. Ratios are WCAG 2.1 contrast.

**Light** — page `#ffffff`, tint (sidebar, insets) `#f7f7f5`, hairline
`rgba(55,53,47,0.10)`.

| Tier | Hex | vs page | vs tint |
| --- | --- | --- | --- |
| ink | `#37352f` | 12.26 | 11.43 |
| soft | `#5c5b56` | 6.81 | 6.34 |
| faint | `#71706b` | 4.96 | 4.63 |

**Dark** — page `#191919`, tint `#252525`, hairline `rgba(255,255,255,0.09)`.

| Tier | Hex | vs page | vs tint |
| --- | --- | --- | --- |
| ink | `#e9e9e7` | 14.46 | 12.61 |
| soft | `#a8a8a4` | 7.37 | 6.42 |
| faint | `#8c8c88` | 5.21 | 4.54 |

All three text tiers clear AA (4.5:1) on both surfaces in both themes. This is
deliberately stricter than Notion itself, whose tertiary text sits near 3.3:1 —
this app renders 10–11px metadata in the faint tier, so it has to be readable.

### Stage colours

The existing hues were validated as saturated dots. Converting them to tinted
labels changes what must be measured: tint versus same-hue text, where 4.5:1 is
the bar. All four pairs were re-checked and one was corrected.

**Light**

| Stage | Tint | Text | Ratio |
| --- | --- | --- | --- |
| Editing | `#f4f0fb` | `#6940a5` | 6.50 |
| Review | `#e7f3f8` | `#0b6e99` | 5.01 |
| To Post | `#faf3dd` | `#8a6100` | 4.99 |
| Posted | `#eef3ed` | `#2f6e4a` | 5.41 |

`To Post` originally came out at **4.21 — a fail**. The amber text was darkened
from `#996c00` to `#8a6100`, which clears the bar at 4.99 while still reading
as amber.

**Dark**

| Stage | Tint | Text | Ratio |
| --- | --- | --- | --- |
| Editing | `#2b2142` | `#b592f0` | 5.96 |
| Review | `#15303d` | `#77bddd` | 6.64 |
| To Post | `#332711` | `#dfab5f` | 7.04 |
| Posted | `#1a2e23` | `#71b391` | 5.87 |

The original constraint still holds and is now easier to satisfy: a stage is
never communicated by colour alone — the label is the primary encoding and the
tint is reinforcement. That is what permitted the 6–8 CVD separation band
before, and a tinted label satisfies it more strongly than a dot did.

### Geometry and type

- Radii: `4px` default, `6px` for floating layers. The current 14/18px goes.
- Borders replace shadows on static surfaces. Shadows appear only on things
  that float: dialogs, popovers, the command palette, drag overlays.
- Body 13px / 1.5, section labels 11px uppercase tracked, page titles 15px
  semibold. Notion's density: compact rows, generous vertical rhythm.
- Inter stays.

### `ui.ts` as the single vocabulary

`ui.ts` is rewritten as the whole design vocabulary and becomes the only place
colour is written. The 261 hardcoded values are deleted as each file is
migrated. Adding a raw hex to a component is thereafter a review failure — that
is the drift the file was created to prevent, and it drifted anyway.

## The shell

A new `AppShell` component owns navigation for every authenticated route.

```
┌──────────────┬─────────────────────────────────────┐
│ Limi      ⌘K │  Client name · Board          [+]   │  ← breadcrumb bar
│ user@…       ├─────────────────────────────────────┤
│              │                                     │
│ Today      3 │   main region                       │
│ Clients      │                                     │
│  ▸ Acme    2 │                                     │
│  ▾ Bolt      │                                     │
│     Board    │                                     │
│     Calendar │                                     │
│     Ideas    │                                     │
│  ▸ Cine      │                                     │
│ Team         │                                     │
│              │                                     │
│ ☾  Sign out  │                                     │
└──────────────┴─────────────────────────────────────┘
```

- **Width** 248px, collapsible to a 48px icon rail, persisted per user in
  `localStorage`.
- **Client tree.** Each client expands to Board / Calendar / Ideas. This is
  what replaces the pill switcher and the back button.
- **Attention badges.** A count beside each client showing items awaiting that
  client's review. This is the highest-value addition per pixel in the whole
  redesign: it turns the sidebar from a list of names into a worklist, and it
  is free — the data is already subscribed for the board counts.
- **Roles.** Client-role users see only their assigned clients and no Team
  entry. `Today` is scoped to what they can see.
- **Mobile.** Below `sm` the sidebar becomes a slide-over drawer behind a
  hamburger in the breadcrumb bar. `BottomNav` is deleted.
- **Breadcrumb bar** carries the current location, the view switcher for the
  active client, and the primary action for that page.

## New capabilities

These are the "genuinely better" part. Each is client-side over data the app
already holds, and each addresses a specific observed weakness.

### 1. `Today` — a cross-client work queue, and the new home

**Problem it solves.** There is currently no view that answers "what needs me
today". The clients grid is a filing cabinet: to find the three items awaiting
review you open four boards. `Dashboard` computes counts but does not surface
the underlying items.

**Design.** Root route becomes `Today`, four grouped sections over all visible
clients:

- **Waiting on a client** — in Review, `clientReview === 'pending'`
- **Needs rework** — `clientReview === 'declined'`
- **Going out soon** — `scheduledAt` within 7 days, not yet Posted
- **Recently decided** — approved or declined in the last 7 days

Each row shows client, title, stage pill, and its one obvious action. Empty
state is the good case and says so.

The existing clients grid stays, reachable as `Clients`.

### 2. Command palette (`⌘K` / `Ctrl+K`)

**Problem it solves.** No search exists anywhere. With a dozen clients and
hundreds of items, finding one means clicking through boards.

**Design.** Fuzzy search over an in-memory index of clients, views, and content
titles — all already subscribed via `useClients`, so no new reads. Results
grouped by type. Also exposes commands: toggle theme, collapse sidebar, create
content. Scoped by role: a client-role user's index contains only their
assigned clients.

### 3. Board / Table view modes

**Problem it solves.** Cards are good for a handful of items and bad for
scanning fifty. There is no way to see all of a client's content sorted by
schedule, or to compare review states at a glance.

**Design.** Per-client toggle between **Board** (kanban, as now) and **Table** —
a compact list with columns for title, stage, platforms, scheduled date, review
state, and last activity. Sortable by clicking a header. This is Notion's
central idea: one dataset, several views. Persisted per client.

### 4. Filters

**Problem it solves.** A board with sixty items has no way to answer "what
Instagram content is scheduled this month".

**Design.** Filter chips in the breadcrumb bar: platform, review state,
scheduled window, media type. They apply to Board and Table alike. Active
filters render as removable chips so state is never hidden.

### 5. Bulk selection and bulk stage change

**Problem it solves.** Moving ten items to Posted is ten separate drags and ten
separate writes.

**Design.** In Table view, checkbox selection with shift-click ranges, then a
selection bar offering stage change and delete. Writes go through a Firestore
`writeBatch` — one atomic commit instead of N, which is also strictly safer
than the current per-item writes.

### 6. Keyboard support

**Problem it solves.** There is none today, and drag-and-drop is mouse-only —
which as of this week is the *only* way to reorder on the board, and is
unusable without a pointer.

**Design.** `⌘K` palette, `Esc` closes any layer, `/` focuses filter, `j`/`k`
move through rows in Table, `Enter` opens. Critically, dnd-kit's
`KeyboardSensor` is added alongside the pointer and touch sensors, making stage
changes reachable from the keyboard. The stage picker shipped this week already
covers the same need through a different route.

### 7. Density toggle

Comfortable and compact, persisted. An agency scanning a hundred items wants
compact; a client reviewing three wants comfortable.

### 8. Real empty states

Every empty surface gets a sentence explaining what belongs there and a button
that creates it. Currently they render blank or say "Nothing here yet", which
teaches nothing.

## Phasing

Four phases, each independently reviewable and deployable.

**Phase 1 — Foundation and shell.** `tailwind.config.js` palette for both
themes, `ui.ts` rewritten as the vocabulary, `ThemeContext` defaults to light,
new `AppShell` with sidebar/drawer/breadcrumb and attention badges, `BottomNav`
deleted, `ClientsPage` and `ClientCard` migrated, empty states, density
groundwork. After this the app reads as the new product on the pages opened
first.

**Phase 2 — Board.** `ClientBoardPage` restructured onto the shell,
`KanbanColumn`, `ContentCard`, Table view, filters, bulk actions,
`KeyboardSensor`, `Dashboard`, `ContentCalendar`. The bulk of the work: 156 of
the 261 hardcoded values.

**Phase 3 — Today and the command palette.** The two genuinely new surfaces,
built once the vocabulary is settled so they are not rewritten mid-flight.

**Phase 4 — Modals and remaining pages.** `ContentDetailModal` recomposed
against the new vocabulary, `AddContentModal`, `AddClientModal`, `IdeasView`,
`LoginPage`, `UserManagementPage`, `PublicReviewPage`, notification banner.

## Risks

- **Mixed appearance between phases.** Unmigrated surfaces look half-new;
  `IdeasView` and `PublicReviewPage` will look stale until Phase 4. Acceptable
  only because the user is not promoting to production mid-refactor. If that
  changes, phases must be squashed before promotion.
- **The sidebar costs horizontal room the kanban wants.** 248px off a 1440px
  window leaves 1192px for four columns — adequate, but the collapse-to-rail
  affordance is not optional, it is what makes narrow laptops workable.
- **`ClientBoardPage` is 678 lines before adding view modes and filters.** It
  must be decomposed during Phase 2 — extracting the board, the table, the
  filter bar and the view state — or it becomes unmaintainable. This is
  in-scope work, not a follow-up.
- **The command palette indexes all content in memory.** Fine at current scale;
  if content grows into the thousands the index needs windowing. Documented
  rather than pre-solved.
- **Regression surface is the whole UI.** There are no UI tests. Verification
  is per-phase geometry and computed-style checks in the browser, the same
  method used for the dialog rebuild this week, plus a typecheck and build gate
  on every phase.

## Deferred

- Unread-comment badges on cards. Needs per-user last-read state; `localStorage`
  would work but the value is lower than the eight items above.
- Saved filter views per client (Notion's "views" proper).
- Realtime presence or multiplayer cursors. No.
- Respecting `prefers-color-scheme` on first load. The user asked for white by
  default explicitly, so the OS hint is deliberately ignored; the toggle
  remains and the choice persists.
