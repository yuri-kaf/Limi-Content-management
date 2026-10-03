# Businesses, Campaigns and the Client Workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a client from "a kanban board" into a workspace with Overview / Content / Campaigns / Calendar / Ideas tabs, backed by two new concepts — businesses (one client can run several) and campaigns (a brief, dates, and a deliverables checklist that fills itself in).

**Architecture:** Two new Firestore subcollections under each client (`businesses`, `campaigns`) plus three optional fields on content (`businessId`, `campaignId`, `deliverableId`). All derived numbers — progress, scope, attention queues — are pure functions in `src/campaigns.ts` and `src/workspace.ts`, unit-tested without Firebase. The old `ClientBoardPage` is split: its kanban becomes a reusable `ContentBoard`, and a new `ClientWorkspacePage` owns tabs, business scope (`?b=`) and every modal.

**Tech Stack:** React 18, TypeScript 5.9, Vite, Tailwind 3.4, Firebase Firestore (Spark plan, no backend), react-router 6.30, dnd-kit, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-03-businesses-campaigns-workspace-design.md`

---

## Ground rules for every task

- Run commands from the repo root: `C:\Users\ashim\Limi-Content-management`.
- Baseline before Task 1: `npx vitest run` → 93 passed; `npx tsc --noEmit` → no output.
- **Firestore rejects `undefined` field values** (the whole write fails, even nested inside an array). Never write an object that may hold `undefined`; omit the key instead. `src/store.ts` gains a `defined()` helper for this in Task 9.
- Comments in this codebase explain *why*, in full sentences. Match that.
- Commit after every task. Commit messages are imperative sentences without a prefix (see `git log`). End each with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `useTheme()` throws outside `<ThemeProvider>`. Any component test that renders `StagePill` or `StageTabs` must wrap in `ThemeProvider`. New coloured components use CSS custom properties (Task 2) so they do **not** need the theme.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/types.ts` | modify | `Business`, `Campaign`, `Deliverable`, `FolderColor`, drafts; new optional fields |
| `src/folderColors.ts` | create | The 10 folder colours, contrast-checked, and CSS-variable helpers |
| `src/campaigns.ts` | create | Pure: scope, progress, sorting, business rules, migration plan, dates |
| `src/workspace.ts` | create | Pure: tab list per role, URL building, `?b=` resolution |
| `src/store.ts` | modify | Businesses subscription + writes, migration, `useCampaigns`, `markIdeaConverted` |
| `firestore.rules` | modify | Read/write rules for `businesses` and `campaigns` |
| `src/ui.ts` | modify | Workspace tab, scope chip and toolbar select class strings |
| `src/today.ts` | modify | `TodayEntry.clientColor` |
| `src/nav.ts` | modify | `NavClient.color` |
| `src/components/ColorSwatchPicker.tsx` | create | Folder-colour radio group |
| `src/components/ColorLabel.tsx` | create | Small tinted label in a folder colour |
| `src/components/ProgressBar.tsx` | create | Thin progress bar (span-based, valid inside buttons) |
| `src/components/QueueGroup.tsx` | create | Today's queue rows, extracted for reuse in Overview |
| `src/components/BusinessModal.tsx` | create | Create/edit/delete a business |
| `src/components/CampaignModal.tsx` | create | Create/edit/delete a campaign, deliverables editor |
| `src/components/workspace/ContentBoard.tsx` | create | The kanban, extracted from `ClientBoardPage`, plus campaign filter |
| `src/components/workspace/WorkspaceTabs.tsx` | create | Tab bar |
| `src/components/workspace/WorkspaceMenu.tsx` | create | "⋯" menu: new campaign, add business, edit client |
| `src/components/workspace/BusinessScopeBar.tsx` | create | All / Business 1 / Business 2 chips (renders nothing for one business) |
| `src/components/workspace/BusinessCard.tsx` | create | One business on Overview |
| `src/components/workspace/CampaignCard.tsx` | create | One campaign with progress |
| `src/components/workspace/CampaignsTab.tsx` | create | Campaigns grouped Live / Planning / Completed |
| `src/components/workspace/OverviewTab.tsx` | create | Businesses, stage counts, attention queue, active campaigns |
| `src/components/workspace/CampaignPage.tsx` | create | Brief, deliverables checklist, campaign board |
| `src/components/AddContentModal.tsx` | modify | Business / campaign / deliverable pickers; labelled inputs |
| `src/components/ContentCard.tsx` | modify | Campaign label |
| `src/components/KanbanColumn.tsx` | modify | Pass campaign to cards |
| `src/components/ClientModal.tsx` | modify | Folder colour field |
| `src/components/ClientAvatar.tsx` | modify | Fallback tinted in the folder colour |
| `src/components/IdeasView.tsx` | modify | Business scoping |
| `src/components/Sidebar.tsx`, `src/components/AppShell.tsx` | modify | Pass colour to avatars |
| `src/pages/ClientsPage.tsx` | modify | "Set up businesses" migration banner |
| `src/pages/TodayPage.tsx` | modify | Use `QueueGroup` |
| `src/pages/ClientWorkspacePage.tsx` | create | The workspace page |
| `src/pages/ClientBoardPage.tsx` | delete | Replaced by the two above |
| `src/App.tsx` | modify | Routes |

## Decisions made while planning (deviations from the spec, all small)

1. `src/palette.ts` is the **command palette**, not a colour module. Folder colours get their own file, `src/folderColors.ts`.
2. **Client-role users see Content, Calendar and Ideas only** — exactly the three views they have today. Overview and Campaigns are team-facing; the client-facing version is sub-project 3 (client portal).
3. **One business-scope mechanism**, not two: a chip bar under the tabs (only with 2+ businesses) sets `?b=`; Overview's business cards set the same parameter.
4. The **folder colour is picked in the client form** (create/edit), like choosing a folder colour in OneDrive. It is visible now on the avatar fallback; sub-project 2 renders the folder icon.
5. The **campaign page has Plan / Board views** rather than a short kanban squeezed under the checklist.
6. **"Add business" and "New campaign" stay hidden until the client has its first business** (i.e. until the migration has run for it), so a business added before migration can't swallow the client's existing content.
7. Found in passing and fixed in the page rewrite: converting an idea never called `markConverted`, so "Make content" never went away.

Added after the Task 1 review:

8. **Businesses are subscribed for every client inside `useClients()`**, not through a per-client `useBusinesses(clientId)` as the spec said. The migration banner has to see every client's businesses, which a per-client hook cannot provide. Cost: one more listener per client.
9. **Campaign dates are calendar days, `'YYYY-MM-DD'` strings**, not timestamps. A timestamp saved at midnight in Kathmandu reads as the day before anywhere west of it — every client in Europe or the Americas once the portal shows campaigns.
10. **The first business can never be deleted**, because everything without a `businessId` belongs to it. Deleting any other business moves its ideas to the first business in the same batch rather than leaving them pointing at nothing; content and campaigns still block the delete.

Added after the Tasks 2–7 review (already applied to the committed code in `fa3441a`; the later tasks below are written against it):

11. **Tests run in processes** (`pool: 'forks'` in `vite.config.ts`): a test that assigns `process.env.TZ` changes the zone only in a process of its own; under worker threads the assignment is ignored.
12. **The first business has a fixed id, `DEFAULT_BUSINESS_ID = 'main'`** (exported from `src/campaigns.ts`), used by `addClient` and by the migration, so two simultaneous migration runs write one document instead of two "first" businesses.
13. **`DeliverableProgress.planned`** (the target, or more if more were made) is what every progress display reads — the campaign total sums it — so a deliverable row and its campaign can never disagree.
14. `businessIdOf` falls back to the first business when an item's stored business no longer exists; `tabsFor` grants the team tabs only to admin and social-media-manager; `formatDateRange` shows a one-day range once and treats malformed days as no date.

Added after the Tasks 8–10 review (applied in `3a46a5c`; the Task 9 and 10 code blocks below show the pre-review version — the committed `src/store.ts` is authoritative):

15. **Only server snapshots count as loaded** (`snap.metadata.fromCache` is ignored), and the loaded map resets with the lists, so neither migration can plan against an offline cache. The legacy content migration got the same guard — before it, a click during the gap between a client's document and its content snapshot could copy old array items over live documents.
16. **`migrateBusinesses` asks the server** (`getDocsFromServer`) whether a client already has a business before creating `'main'`, so it can never overwrite an existing first business; offline it refuses to run.
17. **`deleteBusiness` re-checks on the server** that the business is not `'main'` and has no content or campaigns, throwing a readable error otherwise. `updateCampaign` re-files every linked item whose business differs, judged from the content, not the hook's copy of the campaign. `updateContent` clears `deliverableId` when a campaign is named without one.
18. **Task 24 keys the workspace by client** (`<Workspace key={client.id} …/>`), so switching clients — including with ⌘K while a form is open — starts fresh rather than carrying a form or campaign list into the wrong client.
19. **Batch size and the rules' access-call budget:** Firestore allows 20 document-access calls per batched write and only says repeated calls *may* be cached. Every write here evaluates `isAdmin()` (an `exists` and a `get` of the caller's profile). Batches are kept at up to 400 writes; the supervised migration in Task 25 is the test — a rejected batch writes nothing — and if it fails with `permission-denied`, lower `BATCH_LIMIT` and chunk the other multi-write batches.
20. **Tailwind same-property overrides do not work by class order** (found in the Tasks 11–14 review): `${input} w-[96px]` keeps `input`'s `w-full`, because Tailwind orders utilities itself. New code overrides with `!` where it must (the deliverables row) or uses the base size. Existing `h-9 min-h-0` button overrides throughout the app already render at the base size and the current look depends on it, so they are left for the visual refresh (sub-project 2).
21. **The business and campaign forms await `onSave`** and stay open when it resolves `false`, so the page's save handlers return `runWrite(...)`'s result (Task 24).

---

### Task 1: Types and the businesses read path

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store.ts`
- Modify: `src/nav.test.ts:11-13`, `src/palette.test.ts:11-13`, `src/today.test.ts:14-16`

- [ ] **Step 1: Add the new types to `src/types.ts`**

After the `Platform` line (line 5), insert:

```ts

// The macOS-style folder colours a client, business or campaign can carry.
// The hex values live in src/folderColors.ts.
export type FolderColor =
  | 'blue' | 'sky' | 'teal' | 'green' | 'yellow'
  | 'orange' | 'red' | 'pink' | 'purple' | 'graphite';

export type CampaignStatus = 'planning' | 'live' | 'completed';
```

In `ContentItem`, after `reviewNote?: string;` insert:

```ts
  // Absent only on items created before businesses existed. Read it through
  // businessIdOf(), which treats absent as the client's first business.
  businessId?: string;
  /** At most one. Read through campaignIdOf(), which ignores a deleted campaign. */
  campaignId?: string;
  /** The campaign deliverable this item fills, if any. */
  deliverableId?: string;
```

In `Idea`, after `convertedContentId?: string;` insert:

```ts
  /** Absent on ideas submitted before businesses existed — the first business. */
  businessId?: string;
```

Replace the whole `Client` interface at the end of the file with:

```ts
// One marketing business a client runs. Every client has at least one; a
// client with a single business never sees this layer in the UI.
export interface Business {
  id: string;
  name: string;
  color: FolderColor;
  logoUrl?: string;
  about: string;
  createdAt: number;
}

/** What the business form produces. */
export type BusinessDraft = Omit<Business, 'id' | 'createdAt'>;

// A planned piece of a campaign — "3 Reels". Progress is never stored: it is
// counted from the content whose deliverableId points here.
export interface Deliverable {
  id: string;
  label: string;
  /** Pre-fills the add-content form. Absent means either kind. */
  mediaType?: MediaType;
  /** How many are planned. At least 1. */
  target: number;
}

export interface Campaign {
  id: string;
  businessId: string;
  name: string;
  brief: string;
  status: CampaignStatus;
  // Calendar days as 'YYYY-MM-DD', not timestamps. A day has no time zone: a
  // timestamp saved at midnight in Kathmandu reads as the day before anywhere
  // west of it. ISO days also sort correctly as plain strings.
  startDate?: string;
  endDate?: string;
  color: FolderColor;
  deliverables: Deliverable[];
  createdAt: number;
}

/** What the campaign form produces. */
export type CampaignDraft = Omit<Campaign, 'id' | 'createdAt'>;

export interface Client {
  id: string;
  name: string;
  imageUrl?: string;
  about: string;
  /** Folder colour. Absent on clients created before colours existed. */
  color?: FolderColor;
  content: ContentItem[];
  /** Oldest first. The first also holds anything that has no businessId yet. */
  businesses: Business[];
  createdAt: number;
}
```

- [ ] **Step 2: Run the type-check to see what the new required field breaks**

Run: `npx tsc --noEmit`
Expected: FAIL — errors in `src/store.ts` (clients memo missing `businesses`) and in `src/nav.test.ts`, `src/palette.test.ts`, `src/today.test.ts` (`Property 'businesses' is missing`).

- [ ] **Step 3: Fix the three test fixtures**

In `src/nav.test.ts`, replace

```ts
  return { id, name: id.toUpperCase(), about: '', content, createdAt: 1 };
```

with

```ts
  return { id, name: id.toUpperCase(), about: '', content, businesses: [], createdAt: 1 };
```

Make the same change in `src/today.test.ts` (identical line). In `src/palette.test.ts`, replace

```ts
  return { id, name, about: '', content, createdAt: 1 };
```

with

```ts
  return { id, name, about: '', content, businesses: [], createdAt: 1 };
```

- [ ] **Step 4: Subscribe to each client's businesses in `src/store.ts`**

4a. In the `./types` import, add `Business` and `FolderColor`:

```ts
import {
  AppUser, Business, Client, ClientReview, Comment, ContentItem, ContentStatus, FolderColor, Idea,
  IdeaStatus, MediaType, Platform, Share,
} from './types';
```

4b. Replace

```ts
type BaseClient = Omit<Client, 'content'> & { legacyContent: ContentItem[] };
```

with

```ts
type BaseClient = Omit<Client, 'content' | 'businesses'> & { legacyContent: ContentItem[] };
```

4c. Directly after the `contentDoc` function, add:

```ts
function businessesCol(clientId: string) {
  return collection(db, 'clients', clientId, 'businesses');
}
```

4d. In `toBaseClient`, after `about: data.about as string,` add `color: data.color as FolderColor | undefined,`. In `toBaseFromCache`, after `about: c.about,` add `color: c.color,`.

4e. In `useClients`, directly after the `contentByClient` state, add:

```ts
  // Old caches predate businesses, hence the fallback.
  const [businessesByClient, setBusinessesByClient] = useState<Record<string, Business[]>>(() =>
    Object.fromEntries(readClientsCache(uid).map((c) => [c.id, c.businesses ?? []]))
  );
```

4f. Directly after the content-subscription `useEffect` (the one ending `}, [uid, clientIdsKey]);`), add:

```ts
  // Same shape as the content subscription: one listener per client, oldest
  // business first, because the first one is the default.
  useEffect(() => {
    if (!uid) return;
    const ids = clientIdsKey ? clientIdsKey.split(',') : [];
    if (ids.length === 0) {
      setBusinessesByClient({});
      return;
    }

    const unsubscribes = ids.map((id) =>
      onSnapshot(
        query(businessesCol(id), orderBy('createdAt', 'asc')),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Business, 'id'>), id: d.id }));
          setBusinessesByClient((prev) => ({ ...prev, [id]: list }));
        },
        (err) => console.error(`[limi] businesses subscription for ${id} failed`, err)
      )
    );

    return () => unsubscribes.forEach((u) => u());
  }, [uid, clientIdsKey]);
```

4g. Replace the `clients` memo with:

```ts
  const clients = useMemo<Client[]>(
    () =>
      baseClients.map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
        about: c.about,
        color: c.color,
        createdAt: c.createdAt,
        content: contentByClient[c.id] ?? [],
        businesses: businessesByClient[c.id] ?? [],
      })),
    [baseClients, contentByClient, businessesByClient]
  );
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → no output.
Run: `npx vitest run` → 93 passed.

Until the rules in Task 8 are deployed, the businesses listener logs `permission-denied` and every client has `businesses: []`. That is the intended degraded state: with fewer than two businesses no business UI renders.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/store.ts src/nav.test.ts src/palette.test.ts src/today.test.ts
git commit -m "Add business and campaign types and subscribe to each client's businesses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Folder colour palette

**Files:**
- Create: `src/folderColors.ts`
- Test: `src/folderColors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/folderColors.test.ts`:

```ts
import { contrastRatio } from './color';
import { DEFAULT_FOLDER_COLOR, FOLDER_COLORS, folderColor, folderColorVars } from './folderColors';

const AA = 4.5;

describe('folder colours', () => {
  it('offers the ten macOS-style colours, in picker order', () => {
    expect(FOLDER_COLORS.map((c) => c.id)).toEqual([
      'blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'graphite',
    ]);
  });

  it.each(FOLDER_COLORS)('$label label is readable in light mode', (c) => {
    expect(contrastRatio(c.text, c.tint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(FOLDER_COLORS)('$label label is readable in dark mode', (c) => {
    expect(contrastRatio(c.textDark, c.tintDark)).toBeGreaterThanOrEqual(AA);
  });

  it('falls back to blue for a missing or unknown value', () => {
    expect(DEFAULT_FOLDER_COLOR).toBe('blue');
    expect(folderColor(undefined).id).toBe('blue');
    expect(folderColor('chartreuse').id).toBe('blue');
    expect(folderColor('pink').id).toBe('pink');
  });

  it('exposes both theme pairs as custom properties', () => {
    const vars = folderColorVars('green') as Record<string, string>;
    expect(vars['--fc-tint']).toBe('#e3f8ea');
    expect(vars['--fc-text']).toBe('#166534');
    expect(vars['--fc-tint-dark']).toBe('#12301d');
    expect(vars['--fc-text-dark']).toBe('#86efac');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/folderColors.test.ts`
Expected: FAIL — `Failed to resolve import "./folderColors"`.

- [ ] **Step 3: Implement**

Create `src/folderColors.ts`:

```ts
import type { CSSProperties } from 'react';
import { FolderColor } from './types';

export interface FolderColorDef {
  id: FolderColor;
  label: string;
  /** The solid colour: folder icons, swatches, progress fills. Never behind text. */
  swatch: string;
  /** Label background and text, light theme. */
  tint: string;
  text: string;
  /** Label background and text, dark theme. */
  tintDark: string;
  textDark: string;
}

// Chosen to read like the macOS Finder folder colours. Every text/tint pair is
// asserted against WCAG AA in folderColors.test.ts. Green, teal and orange use
// a darker text than the obvious Tailwind 700 because that measured within a
// rounding error of 4.5:1 on its tint.
export const FOLDER_COLORS: FolderColorDef[] = [
  { id: 'blue', label: 'Blue', swatch: '#3b82f6',
    tint: '#e8f0fe', text: '#1d4ed8', tintDark: '#1c2a45', textDark: '#93b4f8' },
  { id: 'sky', label: 'Sky', swatch: '#0ea5e9',
    tint: '#e0f4fc', text: '#0369a1', tintDark: '#102f3d', textDark: '#7dd3fc' },
  { id: 'teal', label: 'Teal', swatch: '#14b8a6',
    tint: '#ddf6f2', text: '#115e59', tintDark: '#0f302c', textDark: '#5eead4' },
  { id: 'green', label: 'Green', swatch: '#22c55e',
    tint: '#e3f8ea', text: '#166534', tintDark: '#12301d', textDark: '#86efac' },
  { id: 'yellow', label: 'Yellow', swatch: '#eab308',
    tint: '#fdf6d8', text: '#854d0e', tintDark: '#33290c', textDark: '#fcd34d' },
  { id: 'orange', label: 'Orange', swatch: '#f97316',
    tint: '#feeedd', text: '#9a3412', tintDark: '#3a2213', textDark: '#fdba74' },
  { id: 'red', label: 'Red', swatch: '#ef4444',
    tint: '#fde8e8', text: '#b91c1c', tintDark: '#3d1a1a', textDark: '#fca5a5' },
  { id: 'pink', label: 'Pink', swatch: '#ec4899',
    tint: '#fce7f3', text: '#be185d', tintDark: '#3b1729', textDark: '#f9a8d4' },
  { id: 'purple', label: 'Purple', swatch: '#8b5cf6',
    tint: '#efe9fe', text: '#6d28d9', tintDark: '#2a1f45', textDark: '#c4b5fd' },
  { id: 'graphite', label: 'Graphite', swatch: '#6b7280',
    tint: '#eeeff1', text: '#4b5563', tintDark: '#2a2c30', textDark: '#c4c8cf' },
];

export const DEFAULT_FOLDER_COLOR: FolderColor = 'blue';

/** A stored value may predate colours or be hand-edited, so anything unknown is blue. */
export function folderColor(value: string | undefined): FolderColorDef {
  return FOLDER_COLORS.find((c) => c.id === value) ?? FOLDER_COLORS[0];
}

// An inline style cannot express a dark-mode variant, and reading the theme
// from context would make every coloured label depend on ThemeProvider. These
// custom properties carry both pairs; `folderTint` picks one with Tailwind's
// `dark:` variant, so the label follows the theme with no JavaScript at all.
export function folderColorVars(value: string | undefined): CSSProperties {
  const c = folderColor(value);
  return {
    '--fc-swatch': c.swatch,
    '--fc-tint': c.tint,
    '--fc-text': c.text,
    '--fc-tint-dark': c.tintDark,
    '--fc-text-dark': c.textDark,
  } as CSSProperties;
}

/** Pair with folderColorVars(). One literal string so Tailwind's scanner sees every class. */
export const folderTint =
  'bg-[color:var(--fc-tint)] text-[color:var(--fc-text)] dark:bg-[color:var(--fc-tint-dark)] dark:text-[color:var(--fc-text-dark)]';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/folderColors.test.ts`
Expected: PASS (23 tests).

- [ ] **Step 5: Commit**

```bash
git add src/folderColors.ts src/folderColors.test.ts
git commit -m "Add the folder colour palette, contrast-checked in both themes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scope helpers

**Files:**
- Create: `src/campaigns.ts`
- Test: `src/campaigns.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/campaigns.test.ts`:

```ts
import { NO_CAMPAIGN, businessIdOf, campaignIdOf, scopeContent } from './campaigns';
import { Business, Campaign, ContentItem } from './types';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 't', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function business(id: string, createdAt = 1): Business {
  return { id, name: id.toUpperCase(), color: 'blue', about: '', createdAt };
}

function campaign(id: string, over: Partial<Campaign> = {}): Campaign {
  return {
    id, businessId: 'b1', name: id, brief: '', status: 'live', color: 'green',
    deliverables: [], createdAt: 1, ...over,
  };
}

const B1 = business('b1');
const B2 = business('b2', 2);

describe('businessIdOf', () => {
  it('uses the stored business', () => {
    expect(businessIdOf(item({ businessId: 'b2' }), [B1, B2])).toBe('b2');
  });

  it('puts an item from before businesses existed in the first business', () => {
    expect(businessIdOf(item(), [B1, B2])).toBe('b1');
  });

  it('is undefined while the client has no business yet', () => {
    expect(businessIdOf(item(), [])).toBeUndefined();
  });
});

describe('campaignIdOf', () => {
  it('returns a campaign that exists', () => {
    expect(campaignIdOf(item({ campaignId: 'c1' }), [campaign('c1')])).toBe('c1');
  });

  it('ignores a campaign that was deleted', () => {
    expect(campaignIdOf(item({ campaignId: 'gone' }), [campaign('c1')])).toBeUndefined();
  });
});

describe('scopeContent', () => {
  const content = [
    item({ id: 'legacy' }),
    item({ id: 'b1-free', businessId: 'b1' }),
    item({ id: 'b1-c1', businessId: 'b1', campaignId: 'c1' }),
    item({ id: 'b2-c2', businessId: 'b2', campaignId: 'c2' }),
    item({ id: 'dangling', businessId: 'b2', campaignId: 'deleted' }),
  ];
  const campaigns = [campaign('c1'), campaign('c2', { businessId: 'b2' })];
  const ids = (scope: Parameters<typeof scopeContent>[1]) =>
    scopeContent(content, scope, [B1, B2], campaigns).map((i) => i.id);

  it('returns everything with no scope', () => {
    expect(ids({})).toHaveLength(5);
  });

  it('scopes to a business, counting legacy items as the first business', () => {
    expect(ids({ businessId: 'b1' })).toEqual(['legacy', 'b1-free', 'b1-c1']);
    expect(ids({ businessId: 'b2' })).toEqual(['b2-c2', 'dangling']);
  });

  it('scopes to one campaign', () => {
    expect(ids({ campaignId: 'c2' })).toEqual(['b2-c2']);
  });

  it('treats a deleted campaign as no campaign', () => {
    expect(ids({ campaignId: NO_CAMPAIGN })).toEqual(['legacy', 'b1-free', 'dangling']);
  });

  it('combines business and campaign', () => {
    expect(ids({ businessId: 'b2', campaignId: NO_CAMPAIGN })).toEqual(['dangling']);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/campaigns.test.ts`
Expected: FAIL — `Failed to resolve import "./campaigns"`.

- [ ] **Step 3: Implement**

Create `src/campaigns.ts`:

```ts
import { Business, Campaign, ContentItem } from './types';

// ─── Scope ───────────────────────────────────────────────────────────────────

/** "Content outside every campaign" in a campaign filter. Never a real id. */
export const NO_CAMPAIGN = '__none__';

/**
 * The business an item or idea belongs to. Anything written before businesses
 * existed has no businessId and belongs to the client's first business — the
 * one the migration creates — so nothing goes missing between deploying this
 * and running the migration.
 */
export function businessIdOf(
  item: { businessId?: string },
  businesses: Pick<Business, 'id'>[]
): string | undefined {
  return item.businessId ?? businesses[0]?.id;
}

/** A campaignId naming a campaign that no longer exists counts as none. */
export function campaignIdOf(
  item: { campaignId?: string },
  campaigns: Pick<Campaign, 'id'>[]
): string | undefined {
  const id = item.campaignId;
  return id && campaigns.some((c) => c.id === id) ? id : undefined;
}

export interface ContentScope {
  businessId?: string;
  /** A campaign id, or NO_CAMPAIGN for items outside every campaign. */
  campaignId?: string;
}

export function scopeContent(
  content: ContentItem[],
  scope: ContentScope,
  businesses: Pick<Business, 'id'>[],
  campaigns: Pick<Campaign, 'id'>[]
): ContentItem[] {
  return content.filter((item) => {
    if (scope.businessId && businessIdOf(item, businesses) !== scope.businessId) return false;
    if (scope.campaignId) {
      const campaign = campaignIdOf(item, campaigns);
      const wanted = scope.campaignId === NO_CAMPAIGN ? undefined : scope.campaignId;
      if (campaign !== wanted) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/campaigns.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/campaigns.ts src/campaigns.test.ts
git commit -m "Add scope helpers for businesses and campaigns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Campaign progress and ordering

**Files:**
- Modify: `src/campaigns.ts`
- Test: `src/campaigns.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/campaigns.test.ts`, extend the import from `./campaigns` to:

```ts
import {
  NO_CAMPAIGN, businessIdOf, campaignIdOf, campaignProgress, campaignStatusMeta,
  deliverableProgress, scopeContent, sortCampaigns, unslottedContent,
} from './campaigns';
```

Append:

```ts
describe('deliverable and campaign progress', () => {
  const reels = { id: 'd-reels', label: 'Reels', mediaType: 'video' as const, target: 3 };
  const carousels = { id: 'd-car', label: 'Carousels', mediaType: 'graphic' as const, target: 2 };
  const summer = campaign('c1', { deliverables: [reels, carousels] });

  const content = [
    item({ id: 'r1', campaignId: 'c1', deliverableId: 'd-reels', status: 'posted', createdAt: 2 }),
    item({ id: 'r2', campaignId: 'c1', deliverableId: 'd-reels', status: 'review', createdAt: 1 }),
    item({ id: 'loose', campaignId: 'c1', status: 'posted' }),
    item({ id: 'orphan', campaignId: 'c1', deliverableId: 'removed', status: 'editing' }),
    item({ id: 'other', campaignId: 'c2', deliverableId: 'd-reels', status: 'posted' }),
  ];

  it('counts linked and posted items per deliverable, oldest first', () => {
    const [r, c] = deliverableProgress(summer, content);
    expect(r.items.map((i) => i.id)).toEqual(['r2', 'r1']);
    expect(r.posted).toBe(1);
    expect(c.items).toHaveLength(0);
  });

  it('treats items with no deliverable, or a removed one, as unslotted', () => {
    expect(unslottedContent(summer, content).map((i) => i.id)).toEqual(['loose', 'orphan']);
  });

  it('plans every target plus unslotted items, and counts every posted item', () => {
    // 3 reels + 2 carousels + 2 unslotted = 7 planned; r1 and loose are posted.
    expect(campaignProgress(summer, content)).toEqual({ posted: 2, planned: 7, ratio: 2 / 7 });
  });

  it('lets a deliverable run over its target without passing 100%', () => {
    const one = campaign('c1', { deliverables: [{ id: 'd', label: 'Post', target: 1 }] });
    const made = [1, 2, 3].map((n) =>
      item({ id: `p${n}`, campaignId: 'c1', deliverableId: 'd', status: 'posted' })
    );
    expect(campaignProgress(one, made)).toEqual({ posted: 3, planned: 3, ratio: 1 });
  });

  it('is zero, not NaN, for an empty campaign', () => {
    expect(campaignProgress(campaign('c1'), [])).toEqual({ posted: 0, planned: 0, ratio: 0 });
  });
});

describe('campaign status', () => {
  it('names and colours each status', () => {
    expect(campaignStatusMeta('live')).toMatchObject({ label: 'Live', color: 'green' });
    expect(campaignStatusMeta('planning')).toMatchObject({ label: 'Planning', color: 'graphite' });
    expect(campaignStatusMeta('completed')).toMatchObject({ label: 'Completed', color: 'blue' });
  });

  it('orders live, planning, completed, then by start date with undated last', () => {
    const sorted = sortCampaigns([
      campaign('done', { status: 'completed' }),
      campaign('plan-undated', { status: 'planning' }),
      campaign('plan-late', { status: 'planning', startDate: '2026-11-01' }),
      campaign('plan-early', { status: 'planning', startDate: '2026-10-01' }),
      campaign('live', { status: 'live' }),
    ]);
    expect(sorted.map((c) => c.id))
      .toEqual(['live', 'plan-early', 'plan-late', 'plan-undated', 'done']);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/campaigns.test.ts`
Expected: FAIL — `campaignProgress is not a function` (and the other new names).

- [ ] **Step 3: Implement**

In `src/campaigns.ts`, change the first import to:

```ts
import { Business, Campaign, CampaignStatus, ContentItem, Deliverable, FolderColor } from './types';
```

Append:

```ts
// ─── Progress ────────────────────────────────────────────────────────────────

export interface DeliverableProgress {
  deliverable: Deliverable;
  /** Items linked to this deliverable, oldest first. */
  items: ContentItem[];
  posted: number;
}

// Progress is counted, never stored, so it cannot drift from the board.
export function deliverableProgress(campaign: Campaign, content: ContentItem[]): DeliverableProgress[] {
  const inCampaign = content.filter((i) => i.campaignId === campaign.id);
  return campaign.deliverables.map((deliverable) => {
    const items = inCampaign
      .filter((i) => i.deliverableId === deliverable.id)
      .sort((a, b) => a.createdAt - b.createdAt);
    return { deliverable, items, posted: items.filter((i) => i.status === 'posted').length };
  });
}

/** In the campaign but filling no deliverable — never slotted, or slotted into one since removed. */
export function unslottedContent(campaign: Campaign, content: ContentItem[]): ContentItem[] {
  const slots = new Set(campaign.deliverables.map((d) => d.id));
  return content
    .filter((i) => i.campaignId === campaign.id && !(i.deliverableId && slots.has(i.deliverableId)))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export interface CampaignProgress {
  posted: number;
  /** Each deliverable's target (or more, if more were made) plus anything unslotted. */
  planned: number;
  /** posted / planned, and 0 when nothing is planned. */
  ratio: number;
}

// Every posted item is also counted in `planned`, so the ratio can never pass
// 1 — making four reels against a target of three plans four, not three.
export function campaignProgress(campaign: Campaign, content: ContentItem[]): CampaignProgress {
  const slots = deliverableProgress(campaign, content);
  const extra = unslottedContent(campaign, content);
  const planned =
    slots.reduce((sum, s) => sum + Math.max(s.deliverable.target, s.items.length), 0) + extra.length;
  const posted =
    slots.reduce((sum, s) => sum + s.posted, 0) + extra.filter((i) => i.status === 'posted').length;
  return { posted, planned, ratio: planned === 0 ? 0 : posted / planned };
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface CampaignStatusMeta {
  id: CampaignStatus;
  label: string;
  color: FolderColor;
}

/** In lifecycle order — the order a status picker lists them. */
export const CAMPAIGN_STATUSES: CampaignStatusMeta[] = [
  { id: 'planning', label: 'Planning', color: 'graphite' },
  { id: 'live', label: 'Live', color: 'green' },
  { id: 'completed', label: 'Completed', color: 'blue' },
];

/** The order campaigns are grouped in: what is running now comes first. */
export const CAMPAIGN_GROUP_ORDER: CampaignStatus[] = ['live', 'planning', 'completed'];

export function campaignStatusMeta(status: CampaignStatus): CampaignStatusMeta {
  return CAMPAIGN_STATUSES.find((s) => s.id === status) ?? CAMPAIGN_STATUSES[0];
}

// ISO days ('YYYY-MM-DD') sort correctly as plain strings. Undated goes last.
function byStartDate(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
}

/** Live, then planning, then completed; within each, by start date with undated last. */
export function sortCampaigns(campaigns: Campaign[]): Campaign[] {
  const rank = (s: CampaignStatus) => CAMPAIGN_GROUP_ORDER.indexOf(s);
  return [...campaigns].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      byStartDate(a.startDate, b.startDate) ||
      a.createdAt - b.createdAt
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/campaigns.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add src/campaigns.ts src/campaigns.test.ts
git commit -m "Count campaign progress from linked content and order campaigns by status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Business rules and the migration plan

**Files:**
- Modify: `src/campaigns.ts`
- Test: `src/campaigns.test.ts`

- [ ] **Step 1: Write the failing tests**

Extend the `./campaigns` import in `src/campaigns.test.ts` with `businessDeleteBlocker, businessSummary, defaultBusinessFor, planBusinessMigration`. Append:

```ts
describe('businessSummary', () => {
  it('counts content, review waits and unfinished campaigns for one business', () => {
    const content = [
      item({ id: 'a', status: 'review' }), // no businessId, so the first business
      item({ id: 'b', businessId: 'b1', status: 'posted' }),
      item({ id: 'c', businessId: 'b2', status: 'review' }),
    ];
    const campaigns = [
      campaign('live', { businessId: 'b1', status: 'live' }),
      campaign('plan', { businessId: 'b1', status: 'planning' }),
      campaign('done', { businessId: 'b1', status: 'completed' }),
      campaign('other', { businessId: 'b2' }),
    ];
    expect(businessSummary('b1', [B1, B2], content, campaigns)).toEqual({
      total: 2, awaitingReview: 1, activeCampaigns: 2,
    });
  });
});

describe('businessDeleteBlocker', () => {
  it('never allows deleting the last business', () => {
    expect(businessDeleteBlocker('b1', [B1], [], [])).toMatch(/at least one business/);
  });

  it('never allows deleting the first business, which holds everything unfiled', () => {
    expect(businessDeleteBlocker('b1', [B1, B2], [], [])).toMatch(/first business/);
  });

  it('blocks while the business holds content', () => {
    expect(businessDeleteBlocker('b2', [B1, B2], [item({ businessId: 'b2' })], []))
      .toMatch(/1 content item/);
  });

  it('blocks while the business has campaigns', () => {
    expect(businessDeleteBlocker('b2', [B1, B2], [], [{ businessId: 'b2' }, { businessId: 'b2' }]))
      .toMatch(/2 campaigns/);
  });

  it('allows deleting an empty business', () => {
    expect(businessDeleteBlocker('b2', [B1, B2], [item({ businessId: 'b1' })], [])).toBeNull();
  });
});

describe('defaultBusinessFor', () => {
  it('names, colours and pictures the business after the client', () => {
    expect(
      defaultBusinessFor({ name: 'Acme', imageUrl: 'https://x/a.png', about: 'Hi', color: 'pink' }, 5)
    ).toEqual({ name: 'Acme', color: 'pink', logoUrl: 'https://x/a.png', about: 'Hi', createdAt: 5 });
  });

  it('omits the logo rather than writing undefined, which Firestore rejects', () => {
    const b = defaultBusinessFor({ name: 'Acme' }, 5);
    expect('logoUrl' in b).toBe(false);
    expect(b.color).toBe('blue');
    expect(b.about).toBe('');
  });
});

describe('planBusinessMigration', () => {
  const client = (id: string, content: ContentItem[], businesses: Business[]) =>
    ({ id, content, businesses });

  it('creates a default business and stamps every item for an unmigrated client', () => {
    expect(planBusinessMigration([client('a', [item({ id: 'x' }), item({ id: 'y' })], [])]))
      .toEqual([{ clientId: 'a', createDefault: true, contentIds: ['x', 'y'] }]);
  });

  it('stamps only the items still missing a business', () => {
    expect(planBusinessMigration([
      client('a', [item({ id: 'x', businessId: 'b1' }), item({ id: 'y' })], [B1]),
    ])).toEqual([{ clientId: 'a', createDefault: false, contentIds: ['y'] }]);
  });

  it('creates a business for a client with no content at all', () => {
    expect(planBusinessMigration([client('a', [], [])]))
      .toEqual([{ clientId: 'a', createDefault: true, contentIds: [] }]);
  });

  it('is empty once everything is migrated, so a second run does nothing', () => {
    expect(planBusinessMigration([client('a', [item({ businessId: 'b1' })], [B1])])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/campaigns.test.ts`
Expected: FAIL — `businessSummary is not a function` (and the others).

- [ ] **Step 3: Implement**

In `src/campaigns.ts`, change the imports at the top to:

```ts
import {
  Business, Campaign, CampaignStatus, Client, ContentItem, Deliverable, FolderColor,
} from './types';
import { awaitingReview } from './nav';
import { DEFAULT_FOLDER_COLOR } from './folderColors';
```

Append:

```ts
// ─── Businesses ──────────────────────────────────────────────────────────────

export interface BusinessSummary {
  total: number;
  awaitingReview: number;
  /** Planning or live — anything not yet completed. */
  activeCampaigns: number;
}

export function businessSummary(
  businessId: string,
  businesses: Pick<Business, 'id'>[],
  content: ContentItem[],
  campaigns: Pick<Campaign, 'businessId' | 'status'>[]
): BusinessSummary {
  const mine = content.filter((i) => businessIdOf(i, businesses) === businessId);
  return {
    total: mine.length,
    awaitingReview: awaitingReview(mine),
    activeCampaigns: campaigns.filter(
      (c) => c.businessId === businessId && c.status !== 'completed'
    ).length,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Why a business cannot be deleted, or null when it can. Deleting one that
 * still holds content or campaigns would strand them in no business at all.
 * The first business is never deletable: anything without a businessId —
 * content before the migration, ideas from before businesses existed — belongs
 * to it, and would silently move to whichever business became first instead.
 * (Ideas filed under a later business do not block: deleteBusiness() moves
 * them to the first business in the same batch.)
 */
export function businessDeleteBlocker(
  businessId: string,
  businesses: Pick<Business, 'id'>[],
  content: ContentItem[],
  campaigns: Pick<Campaign, 'businessId'>[]
): string | null {
  if (businesses.length <= 1) return 'A client always keeps at least one business.';
  if (businesses[0].id === businessId) {
    return 'This is the first business, which holds everything filed before businesses existed, so it cannot be deleted. Rename it instead.';
  }
  const items = content.filter((i) => businessIdOf(i, businesses) === businessId).length;
  if (items > 0) {
    return `It still holds ${plural(items, 'content item')}. Move ${items === 1 ? 'it' : 'them'} to another business or delete ${items === 1 ? 'it' : 'them'} first.`;
  }
  const owned = campaigns.filter((c) => c.businessId === businessId).length;
  if (owned > 0) {
    return `It still has ${plural(owned, 'campaign')}. Delete ${owned === 1 ? 'it' : 'them'} first.`;
  }
  return null;
}

/** The business every client starts with, named, coloured and pictured after the client. */
export function defaultBusinessFor(
  client: { name: string; imageUrl?: string; about?: string; color?: FolderColor },
  createdAt: number
): Omit<Business, 'id'> {
  return {
    name: client.name,
    color: client.color ?? DEFAULT_FOLDER_COLOR,
    // Omitted, not undefined: Firestore rejects an undefined field outright.
    ...(client.imageUrl ? { logoUrl: client.imageUrl } : {}),
    about: client.about ?? '',
    createdAt,
  };
}

export interface BusinessMigrationStep {
  clientId: string;
  /** True when the client has no business yet and the migration must create one. */
  createDefault: boolean;
  /** Items that carry no businessId. */
  contentIds: string[];
}

export function planBusinessMigration(
  clients: Pick<Client, 'id' | 'content' | 'businesses'>[]
): BusinessMigrationStep[] {
  return clients
    .map((c) => ({
      clientId: c.id,
      createDefault: c.businesses.length === 0,
      contentIds: c.content.filter((i) => !i.businessId).map((i) => i.id),
    }))
    .filter((s) => s.createDefault || s.contentIds.length > 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/campaigns.test.ts`
Expected: PASS (29 tests).

- [ ] **Step 5: Commit**

```bash
git add src/campaigns.ts src/campaigns.test.ts
git commit -m "Add business summaries, delete rules and the business migration plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Calendar-day helpers

Campaign dates are stored as calendar days, `'YYYY-MM-DD'` strings (see `Campaign` in `src/types.ts`) — exactly what `<input type="date">` produces, so the form needs no conversion. These helpers only display and compare them.

**Files:**
- Modify: `src/campaigns.ts`
- Test: `src/campaigns.test.ts`

- [ ] **Step 1: Write the failing tests**

Extend the `./campaigns` import with `endsBeforeStart, formatDateRange`. Append:

```ts
describe('calendar days', () => {
  it('formats both ends, either end, or neither', () => {
    expect(formatDateRange('2026-10-03', '2026-10-20')).toBe('Oct 3 – Oct 20');
    expect(formatDateRange('2026-10-03')).toBe('From Oct 3');
    expect(formatDateRange(undefined, '2026-10-20')).toBe('Until Oct 20');
    expect(formatDateRange()).toBe('');
  });

  it('reads a day as a local date, so it never shows as the day before', () => {
    // new Date('2026-10-01') is UTC midnight, which is still Sep 30 in Los
    // Angeles. The suite normally runs east of Greenwich, where that bug cannot
    // show, so this pins a western zone. Node re-reads TZ when it is assigned.
    const zone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatDateRange('2026-10-01')).toBe('From Oct 1');
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it('knows when the end comes before the start', () => {
    expect(endsBeforeStart('2026-10-20', '2026-10-03')).toBe(true);
    expect(endsBeforeStart('2026-10-03', '2026-10-03')).toBe(false);
    expect(endsBeforeStart('2026-10-03', '2026-10-20')).toBe(false);
    expect(endsBeforeStart('', '2026-10-03')).toBe(false);
    expect(endsBeforeStart(undefined, undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/campaigns.test.ts`
Expected: FAIL — `formatDateRange is not a function`.

- [ ] **Step 3: Implement**

Append to `src/campaigns.ts`:

```ts
// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * 'YYYY-MM-DD' as "Oct 3". Built from the parts rather than new Date(value),
 * which reads an ISO day as UTC midnight — the day before, west of Greenwich.
 */
function dayLabel(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateRange(start?: string, end?: string): string {
  if (start && end) return `${dayLabel(start)} – ${dayLabel(end)}`;
  if (start) return `From ${dayLabel(start)}`;
  if (end) return `Until ${dayLabel(end)}`;
  return '';
}

/** True only when both days are set and the end comes first. ISO days compare as strings. */
export function endsBeforeStart(start?: string, end?: string): boolean {
  return !!start && !!end && end < start;
}
```

The separator in `formatDateRange` and in its test is an en dash (U+2013) with a space either side.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/campaigns.test.ts`
Expected: PASS (32 tests).

- [ ] **Step 5: Commit**

```bash
git add src/campaigns.ts src/campaigns.test.ts
git commit -m "Add calendar-day helpers for campaign date ranges

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Workspace routing helpers

**Files:**
- Create: `src/workspace.ts`
- Test: `src/workspace.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/workspace.test.ts`:

```ts
import { campaignPath, parseTab, resolveScope, tabsFor, workspacePath } from './workspace';

describe('tabsFor', () => {
  it('gives the team every tab', () => {
    expect(tabsFor('admin').map((t) => t.id))
      .toEqual(['overview', 'content', 'campaigns', 'calendar', 'ideas']);
    expect(tabsFor('social-media-manager')).toHaveLength(5);
  });

  it('gives a client the three views they already had', () => {
    expect(tabsFor('client').map((t) => t.id)).toEqual(['content', 'calendar', 'ideas']);
  });
});

describe('parseTab', () => {
  it('accepts a tab the role can see', () => {
    expect(parseTab('campaigns', tabsFor('admin'))).toBe('campaigns');
  });

  it('falls back to content for a missing, unknown or forbidden tab', () => {
    expect(parseTab(undefined, tabsFor('admin'))).toBe('content');
    expect(parseTab('nonsense', tabsFor('admin'))).toBe('content');
    expect(parseTab('overview', tabsFor('client'))).toBe('content');
  });
});

describe('paths', () => {
  it('keeps the bare client URL for the default tab, so existing links still land there', () => {
    expect(workspacePath('acme', 'content')).toBe('/client/acme');
  });

  it('adds the tab and the business scope', () => {
    expect(workspacePath('acme', 'calendar', 'b2')).toBe('/client/acme/calendar?b=b2');
  });

  it('builds campaign links', () => {
    expect(campaignPath('acme', 'c1')).toBe('/client/acme/campaign/c1');
    expect(campaignPath('acme', 'c1', 'b1')).toBe('/client/acme/campaign/c1?b=b1');
  });
});

describe('resolveScope', () => {
  const two = [{ id: 'b1' }, { id: 'b2' }];

  it('returns a business the client has', () => {
    expect(resolveScope('b2', two)).toBe('b2');
  });

  it('drops a business the client does not have', () => {
    expect(resolveScope('gone', two)).toBeUndefined();
  });

  it('drops any scope when there is only one business', () => {
    expect(resolveScope('b1', [{ id: 'b1' }])).toBeUndefined();
  });

  it('is undefined with no parameter', () => {
    expect(resolveScope(null, two)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/workspace.test.ts`
Expected: FAIL — `Failed to resolve import "./workspace"`.

- [ ] **Step 3: Implement**

Create `src/workspace.ts`:

```ts
import { Business, UserRole } from './types';

export type WorkspaceTab = 'overview' | 'content' | 'campaigns' | 'calendar' | 'ideas';

export interface TabDef {
  id: WorkspaceTab;
  label: string;
}

const ALL_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'ideas', label: 'Ideas' },
];

// Content is where people land: it is what opening a client meant before tabs
// existed, and moving the landing view in the same change as adding tabs would
// be two changes at once.
export const DEFAULT_TAB: WorkspaceTab = 'content';

// Clients keep exactly the three views they had. Overview and Campaigns are
// written for the team — attention queues, deliverable plans — and the
// client-facing version belongs to the client portal, designed separately.
const CLIENT_TABS: WorkspaceTab[] = ['content', 'calendar', 'ideas'];

export function tabsFor(role: UserRole | undefined): TabDef[] {
  return role === 'client' ? ALL_TABS.filter((t) => CLIENT_TABS.includes(t.id)) : ALL_TABS;
}

/** An unknown tab, or one this role cannot see, falls back to the default. */
export function parseTab(value: string | undefined, allowed: TabDef[]): WorkspaceTab {
  return allowed.find((t) => t.id === value)?.id ?? DEFAULT_TAB;
}

function withScope(path: string, businessId?: string): string {
  return businessId ? `${path}?b=${encodeURIComponent(businessId)}` : path;
}

// The default tab keeps the bare URL, so every existing /client/:id link — the
// sidebar, Today, the command palette — still lands where it always did.
export function workspacePath(clientId: string, tab: WorkspaceTab, businessId?: string): string {
  const base = tab === DEFAULT_TAB ? `/client/${clientId}` : `/client/${clientId}/${tab}`;
  return withScope(base, businessId);
}

export function campaignPath(clientId: string, campaignId: string, businessId?: string): string {
  return withScope(`/client/${clientId}/campaign/${campaignId}`, businessId);
}

/**
 * The business named by ?b=. Dropped when the client has fewer than two
 * businesses — there is nothing to choose between — and when it names one the
 * client does not have, such as a business since deleted.
 */
export function resolveScope(
  param: string | null,
  businesses: Pick<Business, 'id'>[]
): string | undefined {
  if (!param || businesses.length < 2) return undefined;
  return businesses.some((b) => b.id === param) ? param : undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/workspace.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/workspace.ts src/workspace.test.ts
git commit -m "Add workspace tab and URL helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Security rules for businesses and campaigns

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the two subcollections**

In `firestore.rules`, inside `match /clients/{clientId} { … }`, directly after the closing brace of the `match /ideas/{ideaId} { … }` block, insert:

```
      // Businesses and campaigns organise content; only the team shapes them.
      // An assigned client reads them so their own boards group the same way.
      // Clients still cannot move content between them: the content update
      // rule above only lets a client change the two review fields.
      match /businesses/{businessId} {
        allow read: if isAdmin() || isManager() || isAssigned(clientId);
        allow create, update, delete: if isAdmin() || isManager();
      }

      match /campaigns/{campaignId} {
        allow read: if isAdmin() || isManager() || isAssigned(clientId);
        allow create, update, delete: if isAdmin() || isManager();
      }
```

- [ ] **Step 2: Check the rules compile**

Run: `npx firebase --version` to confirm the CLI resolves (15.x), then
Run: `npx firebase deploy --only firestore:rules --dry-run`
Expected: `rules file firestore.rules compiled successfully`. If the CLI reports it is not logged in, skip this step — Task 25 deploys with the user present.

**Do not deploy here.** Deploying changes production; Task 25 does it with the user's explicit go-ahead.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Allow the team to manage businesses and campaigns, and clients to read them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Store write path — businesses, filing fields, migration

No unit tests here: this is Firestore glue, and its logic (`defaultBusinessFor`, `planBusinessMigration`) was tested in Task 5. Verification is the type-check plus the full suite.

**Files:**
- Modify: `src/store.ts`

- [ ] **Step 1: Imports**

Replace the `firebase/firestore` import with:

```ts
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDocs,
  writeBatch,
  arrayUnion,
  query,
  where,
  orderBy,
  WriteBatch,
} from 'firebase/firestore';
```

(`addDoc` goes: `addClient` now uses a batch.) Add `BusinessDraft` to the `./types` import. Below the `./utils` import add:

```ts
import { DEFAULT_BUSINESS_ID, defaultBusinessFor, planBusinessMigration } from './campaigns';
import { DEFAULT_FOLDER_COLOR } from './folderColors';
```

- [ ] **Step 2: Shared write helpers**

Directly after the `businessesCol` function, add:

```ts
// Firestore rejects a field whose value is undefined — the whole write fails —
// so optional fields are dropped rather than written empty. One level deep;
// nested objects are cleaned by their callers.
function defined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as T;
}

// A batch holds at most 500 writes. Chunked well under that so one large
// client cannot fail the business migration on size alone.
const BATCH_LIMIT = 400;

async function commitInChunks(writes: ((batch: WriteBatch) => void)[]) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    writes.slice(i, i + BATCH_LIMIT).forEach((write) => write(batch));
    await batch.commit();
  }
}
```

- [ ] **Step 3: Ideas — a business on new ideas, and a working "converted" mark**

In `useIdeas`, change `addIdea`'s parameter type to

```ts
    async (data: { title: string; description: string; links: string[]; businessId?: string }) => {
```

and in the `idea` object it builds, after `links: data.links,` add:

```ts
        ...(data.businessId ? { businessId: data.businessId } : {}),
```

Delete the whole `markConverted` callback from `useIdeas` and remove `markConverted` from its return object (nothing calls it — which is the bug). Directly after the closing brace of `useIdeas`, add:

```ts
// Marks an accepted idea as turned into content, so it stops offering "Make
// content". A plain function rather than part of useIdeas: the conversion
// finishes in the workspace page, which does not hold that hook. The old board
// never called the hook's version, so converted ideas kept the button forever.
export async function markIdeaConverted(clientId: string, ideaId: string, contentId: string) {
  await updateDoc(doc(ideasCol(clientId), ideaId), { convertedContentId: contentId });
}
```

- [ ] **Step 4: Know when live data has arrived**

In `useClients`, directly after the `businessesByClient` state, add:

```ts
  // Which listeners have delivered a live snapshot, keyed `content:<id>` and
  // `businesses:<id>`. The cache seeds the lists above, so without this a cold
  // start would plan the business migration against stale data.
  const [loaded, setLoaded] = useState<Record<string, true>>({});
  const markLoaded = useCallback((key: string) => {
    setLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);
```

In the **content** subscription effect, after `setContentByClient((prev) => ({ ...prev, [id]: items }));` add `markLoaded(\`content:${id}\`);` and change that effect's dependency array to `[uid, clientIdsKey, markLoaded]`.

In the **businesses** subscription effect (added in Task 1), after `setBusinessesByClient((prev) => ({ ...prev, [id]: list }));` add `markLoaded(\`businesses:${id}\`);` and change its dependency array to `[uid, clientIdsKey, markLoaded]`.

- [ ] **Step 4b: Read the cache once, typed for old entries**

The three initial states each parse the whole cache, and the cache is typed `Client[]` although entries written before businesses existed have no `businesses`. Fix both.

Directly above `function readClientsCache`, add:

```ts
// What the cache holds. Typed apart from Client because entries written before
// businesses existed have no `businesses`.
type CachedClient = Omit<Client, 'businesses'> & { businesses?: Business[] };
```

Change `readClientsCache` to return `CachedClient[]` (its signature and its `JSON.parse(raw) as …` cast), and `toBaseFromCache`'s parameter to `c: CachedClient`. `writeClientsCache` keeps taking `Client[]`.

In `useClients`, replace the three cache-seeded `useState` calls (`baseClients`, `contentByClient`, `businessesByClient`) with:

```ts
  // Parsed once: every initial list below is seeded from the same read.
  const [cached] = useState(() => readClientsCache(uid));
  const [baseClients, setBaseClients] = useState<BaseClient[]>(() => cached.map(toBaseFromCache));
  const [contentByClient, setContentByClient] = useState<Record<string, ContentItem[]>>(() =>
    Object.fromEntries(cached.map((c) => [c.id, c.content]))
  );
  // Caches written before businesses existed have none, hence the fallback.
  const [businessesByClient, setBusinessesByClient] = useState<Record<string, Business[]>>(() =>
    Object.fromEntries(cached.map((c) => [c.id, c.businesses ?? []]))
  );
```

Replace the comment above the content subscription effect (`// One subscription per client's content subcollection. …`) with:

```ts
  // One listener per client for its content, and one more for its businesses
  // (below) — every client's, because the business migration has to see them
  // all. Accurate by construction, unlike denormalised counters; revisit
  // around 50+ clients, when two listeners each start to add up.
```

- [ ] **Step 5: The pending business migration**

Directly after the existing `pendingMigration` memo, add:

```ts
  // Only clients whose content and businesses have both arrived live. Planning
  // against the cache could create a second default business, or stamp an
  // item that has since been deleted — and one bad update fails its batch.
  const pendingBusinessMigration = useMemo(
    () =>
      planBusinessMigration(
        clients.filter((c) => loaded[`content:${c.id}`] && loaded[`businesses:${c.id}`])
      ),
    [clients, loaded]
  );
```

- [ ] **Step 6: Clients are created with their first business, and carry a colour**

Replace `addClient` and `updateClient` with:

```ts
  // The client and its first business are written in one batch, so no client
  // ever exists without a business.
  const addClient = useCallback(
    async (data: { name: string; imageUrl?: string; about: string; color?: FolderColor }) => {
      const clientRef = doc(collection(db, 'clients'));
      const now = Date.now();
      const batch = writeBatch(db);
      batch.set(clientRef, {
        name: data.name,
        imageUrl: data.imageUrl || '',
        about: data.about,
        color: data.color ?? DEFAULT_FOLDER_COLOR,
        createdAt: now,
      });
      batch.set(doc(businessesCol(clientRef.id), DEFAULT_BUSINESS_ID), defaultBusinessFor(data, now));
      await batch.commit();
    },
    []
  );

  // Writes only the editable fields, so createdAt and anything added to the
  // document later survive an edit untouched.
  const updateClient = useCallback(
    async (
      clientId: string,
      data: { name: string; imageUrl?: string; about: string; color?: FolderColor }
    ) => {
      await updateDoc(doc(db, 'clients', clientId), {
        name: data.name,
        imageUrl: data.imageUrl || '',
        about: data.about,
        ...(data.color ? { color: data.color } : {}),
      });
    },
    []
  );

  const addBusiness = useCallback(async (clientId: string, draft: BusinessDraft) => {
    const ref = doc(businessesCol(clientId));
    await setDoc(
      ref,
      defined({
        name: draft.name,
        color: draft.color,
        logoUrl: draft.logoUrl || undefined,
        about: draft.about,
        createdAt: Date.now(),
      })
    );
    return ref.id;
  }, []);

  const updateBusiness = useCallback(
    async (clientId: string, businessId: string, draft: BusinessDraft) => {
      await updateDoc(doc(businessesCol(clientId), businessId), {
        name: draft.name,
        color: draft.color,
        about: draft.about,
        logoUrl: draft.logoUrl || deleteField(),
      });
    },
    []
  );

  // The UI only offers this for a business with no content and no campaigns
  // that is not the first one — see businessDeleteBlocker(). Ideas do not
  // block it: any filed under this business are moved to the first business
  // (dropping their businessId does exactly that) in the same batch as the
  // delete, so none is left pointing at a business that is gone.
  const deleteBusiness = useCallback(async (clientId: string, businessId: string) => {
    const ideas = await getDocs(query(ideasCol(clientId), where('businessId', '==', businessId)));
    const batch = writeBatch(db);
    ideas.docs.forEach((d) => batch.update(d.ref, { businessId: deleteField() }));
    batch.delete(doc(businessesCol(clientId), businessId));
    await batch.commit();
  }, []);
```

- [ ] **Step 7: Content carries its business, campaign and deliverable**

In `addContent`, add to the `data` parameter type, after `uploadedByEmail: string;`:

```ts
        businessId?: string;
        campaignId?: string | null;
        deliverableId?: string | null;
```

In the `newItem` object, after `reviewNote: '',` add:

```ts
        businessId: data.businessId,
        campaignId: data.campaignId ?? undefined,
        deliverableId: data.deliverableId ?? undefined,
```

and replace `await setDoc(contentDoc(clientId, id), newItem);` with:

```ts
      // The three filing fields are optional; defined() drops the unset ones.
      await setDoc(contentDoc(clientId, id), defined(newItem));
      return id;
```

In `updateContent`, add to the `data` parameter type, after `scheduledAt?: number;`:

```ts
        businessId?: string;
        /** undefined leaves it as it is; null takes the item out of its campaign. */
        campaignId?: string | null;
        deliverableId?: string | null;
```

and in the object passed to `updateDoc`, after `scheduledAt: data.scheduledAt || 0,` add:

```ts
        // Only ever set, never cleared: content always belongs to a business.
        ...(data.businessId ? { businessId: data.businessId } : {}),
        ...(data.campaignId === undefined
          ? {}
          : { campaignId: data.campaignId ?? deleteField() }),
        ...(data.deliverableId === undefined
          ? {}
          : { deliverableId: data.deliverableId ?? deleteField() }),
```

- [ ] **Step 8: Run the migration**

Directly after `migrateLegacyCaptions`, add:

```ts
  // Gives each unmigrated client a default business and stamps its items with
  // it. Idempotent: the business goes out in the first chunk, so a rerun after
  // a partial failure finds it and stamps only what is still missing.
  const migrateBusinesses = useCallback(async () => {
    let stamped = 0;
    for (const step of pendingBusinessMigration) {
      const client = clients.find((c) => c.id === step.clientId);
      if (!client) continue;

      const writes: ((batch: WriteBatch) => void)[] = [];
      let businessId = client.businesses[0]?.id;
      if (step.createDefault || !businessId) {
        const ref = doc(businessesCol(client.id), DEFAULT_BUSINESS_ID);
        businessId = ref.id;
        writes.push((b) => b.set(ref, defaultBusinessFor(client, Date.now())));
      }
      // A const, so the closures below see a string rather than string | undefined.
      const target = businessId;
      for (const contentId of step.contentIds) {
        writes.push((b) => b.update(contentDoc(client.id, contentId), { businessId: target }));
      }

      await commitInChunks(writes);
      stamped += step.contentIds.length;
    }
    return stamped;
  }, [pendingBusinessMigration, clients]);
```

Add to the object `useClients` returns: `addBusiness, updateBusiness, deleteBusiness, pendingBusinessMigration, migrateBusinesses,`.

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit` → no output. (If it reports `addDoc` unused or missing, Step 1 was applied incompletely.)
Run: `npx vitest run` → all passed.

- [ ] **Step 10: Commit**

```bash
git add src/store.ts
git commit -m "Write businesses, file content under a business and campaign, and add the business migration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The campaigns hook

**Files:**
- Modify: `src/store.ts`

- [ ] **Step 1: Imports**

Add `Campaign, CampaignDraft, CampaignStatus` to the `./types` import.

- [ ] **Step 2: Implement `useCampaigns`**

Directly after `businessesCol`, add:

```ts
function campaignsCol(clientId: string) {
  return collection(db, 'clients', clientId, 'campaigns');
}
```

After `markIdeaConverted`, add:

```ts
// ─── Campaigns ───────────────────────────────────────────────────────────────

// Deliverables are written whole, and their optional mediaType must be dropped
// when unset: Firestore rejects undefined even nested inside an array.
function cleanDraft(draft: CampaignDraft) {
  return defined({
    businessId: draft.businessId,
    name: draft.name,
    brief: draft.brief,
    status: draft.status,
    startDate: draft.startDate,
    endDate: draft.endDate,
    color: draft.color,
    deliverables: draft.deliverables.map((d) => defined({ ...d })),
  });
}

function campaignContent(clientId: string, campaignId: string) {
  return query(collection(db, 'clients', clientId, 'content'), where('campaignId', '==', campaignId));
}

export function useCampaigns(clientId: string | undefined) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(campaignsCol(clientId), orderBy('createdAt', 'asc')),
      (snap) => {
        setCampaigns(snap.docs.map((d) => ({ ...(d.data() as Omit<Campaign, 'id'>), id: d.id })));
        setLoading(false);
      },
      (err) => {
        console.error('[limi] campaigns subscription failed', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [clientId]);

  const addCampaign = useCallback(
    async (draft: CampaignDraft) => {
      if (!clientId) return '';
      const ref = doc(campaignsCol(clientId));
      await setDoc(ref, { ...cleanDraft(draft), createdAt: Date.now() });
      return ref.id;
    },
    [clientId]
  );

  // Content in a campaign carries that campaign's business. Moving a campaign
  // to another business moves its content in the same batch, so the two can
  // never disagree.
  const updateCampaign = useCallback(
    async (campaignId: string, draft: CampaignDraft) => {
      if (!clientId) return;
      const previous = campaigns.find((c) => c.id === campaignId);
      const batch = writeBatch(db);
      batch.update(doc(campaignsCol(clientId), campaignId), {
        ...cleanDraft(draft),
        // A cleared date has to be removed, not merely left out of the update.
        ...(draft.startDate === undefined ? { startDate: deleteField() } : {}),
        ...(draft.endDate === undefined ? { endDate: deleteField() } : {}),
      });
      if (previous && previous.businessId !== draft.businessId) {
        const linked = await getDocs(campaignContent(clientId, campaignId));
        linked.docs.forEach((d) => batch.update(d.ref, { businessId: draft.businessId }));
      }
      await batch.commit();
    },
    [clientId, campaigns]
  );

  const setCampaignStatus = useCallback(
    async (campaignId: string, status: CampaignStatus) => {
      if (!clientId) return;
      await updateDoc(doc(campaignsCol(clientId), campaignId), { status });
    },
    [clientId]
  );

  // Deleting a campaign never deletes its content: the items stay on the board,
  // just no longer grouped. One batch, so no item is left pointing at a campaign
  // that is gone — and if one ever is, campaignIdOf() ignores it.
  const deleteCampaign = useCallback(
    async (campaignId: string) => {
      if (!clientId) return;
      const linked = await getDocs(campaignContent(clientId, campaignId));
      const batch = writeBatch(db);
      linked.docs.forEach((d) =>
        batch.update(d.ref, { campaignId: deleteField(), deliverableId: deleteField() })
      );
      batch.delete(doc(campaignsCol(clientId), campaignId));
      await batch.commit();
    },
    [clientId]
  );

  return { campaigns, loading, addCampaign, updateCampaign, setCampaignStatus, deleteCampaign };
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → no output.
Run: `npx vitest run` → all passed.

- [ ] **Step 4: Commit**

```bash
git add src/store.ts
git commit -m "Add the campaigns hook; deleting a campaign keeps its content

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Colour swatches, colour labels, progress bars

**Files:**
- Create: `src/components/ColorSwatchPicker.tsx`, `src/components/ColorLabel.tsx`, `src/components/ProgressBar.tsx`
- Modify: `src/ui.ts` (append)
- Test: `src/components/ColorSwatchPicker.test.tsx`, `src/components/ProgressBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ColorSwatchPicker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorSwatchPicker from './ColorSwatchPicker';

describe('ColorSwatchPicker', () => {
  it('offers every folder colour by name and marks the current one', () => {
    render(<ColorSwatchPicker value="pink" onChange={vi.fn()} label="Folder colour" />);
    expect(screen.getByRole('radiogroup', { name: 'Folder colour' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(screen.getByRole('radio', { name: 'Pink' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'false');
  });

  it('reports the colour that was picked', async () => {
    const onChange = vi.fn();
    render(<ColorSwatchPicker value="blue" onChange={onChange} label="Folder colour" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Teal' }));
    expect(onChange).toHaveBeenCalledWith('teal');
  });
});
```

Create `src/components/ProgressBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import ProgressBar from './ProgressBar';

describe('ProgressBar', () => {
  it('reports its value as a percentage under its label', () => {
    render(<ProgressBar value={2 / 7} color="green" label="2 of 7 posted" />);
    expect(screen.getByRole('progressbar', { name: '2 of 7 posted' }))
      .toHaveAttribute('aria-valuenow', '29');
  });

  it('clamps values outside 0 to 1, and treats NaN as empty', () => {
    const { rerender } = render(<ProgressBar value={1.4} color="green" label="p" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={NaN} color="green" label="p" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/components/ColorSwatchPicker.test.tsx src/components/ProgressBar.test.tsx`
Expected: FAIL — cannot resolve `./ColorSwatchPicker` / `./ProgressBar`.

- [ ] **Step 3: Implement the three components**

Create `src/components/ColorSwatchPicker.tsx`:

```tsx
import { Check } from 'lucide-react';
import { FolderColor } from '../types';
import { FOLDER_COLORS } from '../folderColors';

interface Props {
  value: FolderColor;
  onChange: (color: FolderColor) => void;
  /** Names the group for screen readers, e.g. "Folder colour". */
  label: string;
}

// A radio group drawn as swatches, like choosing a folder colour in Finder or
// OneDrive. Every swatch carries its colour's name, so the choice never rests
// on telling two hues apart.
export default function ColorSwatchPicker({ value, onChange, label }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {FOLDER_COLORS.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(c.id)}
            className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ring-offset-2 ring-offset-canvas dark:ring-offset-canvas-dark ${
              on ? 'ring-2 ring-ink dark:ring-ink-dark' : ''
            }`}
            style={{ backgroundColor: c.swatch }}
          >
            {on && <Check size={14} strokeWidth={3} className="text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
```

Create `src/components/ColorLabel.tsx`:

```tsx
import { ReactNode } from 'react';
import { folderColorVars, folderTint } from '../folderColors';

interface Props {
  color: string | undefined;
  children: ReactNode;
  className?: string;
}

// A short tinted label in one of the folder colours — a campaign on a card, a
// campaign's status. The colours arrive as custom properties, so the label
// follows the theme without reading it (see folderColorVars).
export default function ColorLabel({ color, children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center min-w-0 max-w-full px-1.5 h-[18px] rounded-tile text-[10px] font-semibold whitespace-nowrap ${folderTint} ${className}`}
      style={folderColorVars(color)}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
```

Create `src/components/ProgressBar.tsx`:

```tsx
import { folderColor } from '../folderColors';

interface Props {
  /** 0 to 1. Anything outside is clamped. */
  value: number;
  color: string | undefined;
  /** Read out in place of the bar, e.g. "3 of 7 posted". */
  label: string;
}

// Spans rather than divs so a bar is valid inside a <button> (a campaign card).
// The fill never carries meaning alone — every use sits beside the same numbers
// written out — which is what lets a light swatch like yellow be the fill.
export default function ProgressBar({ value, color, label }: Props) {
  const safe = Number.isFinite(value) ? value : 0;
  const pct = Math.round(Math.min(1, Math.max(0, safe)) * 100);
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="block h-1.5 w-full rounded-full bg-hairline dark:bg-hairline-dark overflow-hidden"
    >
      <span
        className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%`, backgroundColor: folderColor(color).swatch }}
      />
    </span>
  );
}
```

- [ ] **Step 4: Append the workspace class strings to `src/ui.ts`**

```ts

// ---------------------------------------------------------------------------
// Client workspace
// ---------------------------------------------------------------------------

// The tab bar under the breadcrumb. Tabs are underlined rather than boxed: a
// second segmented control there would read as a toolbar, not as places.
export const workspaceTabRow =
  'flex items-center gap-2 px-4 h-11 flex-shrink-0 border-b border-hairline dark:border-hairline-dark';

// Scrolls sideways on a phone instead of wrapping. The scrollbar is hidden
// because a cut-off last tab already says there is more. Only the list
// scrolls, so the menu beside it can still drop down out of the bar.
export const workspaceTabList =
  'flex items-stretch gap-1 h-full min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]';

export function workspaceTab(active: boolean) {
  return `inline-flex items-center h-full px-2 border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:bg-hover dark:focus-visible:bg-hover-dark ${
    active
      ? 'border-ink dark:border-ink-dark text-ink dark:text-ink-dark'
      : 'border-transparent text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// Business scope chips: quiet until chosen, like a nav row.
export function scopeChip(active: boolean) {
  return `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-tile text-[12px] font-medium whitespace-nowrap border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
    active
      ? 'bg-hover dark:bg-hover-dark border-hairline dark:border-hairline-dark text-ink dark:text-ink-dark'
      : 'border-transparent text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark'
  }`;
}

// A compact native select for toolbars, sized to sit beside the 36px buttons.
export const toolbarSelect =
  'h-9 min-w-0 max-w-[140px] sm:max-w-[200px] bg-canvas dark:bg-canvas-dark border border-hairline dark:border-hairline-dark rounded-tile px-2 text-[12px] font-medium text-ink-soft dark:text-ink-softdark focus:outline-none focus:ring-2 focus:ring-brand/30';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/ColorSwatchPicker.test.tsx src/components/ProgressBar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ColorSwatchPicker.tsx src/components/ColorLabel.tsx src/components/ProgressBar.tsx src/components/ColorSwatchPicker.test.tsx src/components/ProgressBar.test.tsx src/ui.ts
git commit -m "Add the colour swatch picker, colour labels and progress bars

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Client folder colour, and the migration banner

**Files:**
- Modify: `src/components/ClientModal.tsx`, `src/components/ClientAvatar.tsx`, `src/nav.ts`, `src/components/Sidebar.tsx`, `src/components/AppShell.tsx`, `src/pages/ClientsPage.tsx`
- Test: `src/components/ClientModal.test.tsx`, `src/nav.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ClientModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientModal from './ClientModal';

describe('ClientModal', () => {
  it('saves the chosen folder colour with a new client', async () => {
    const onSave = vi.fn();
    render(<ClientModal onClose={vi.fn()} onSave={onSave} />);
    await userEvent.type(screen.getByPlaceholderText('Client name'), 'Acme');
    await userEvent.click(screen.getByRole('radio', { name: 'Purple' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Acme', imageUrl: undefined, about: '', color: 'purple',
    });
  });

  it("starts from the client's current colour when editing", () => {
    render(
      <ClientModal
        client={{ id: 'a', name: 'Acme', about: '', color: 'teal', content: [], businesses: [], createdAt: 1 }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true');
  });
});
```

In `src/nav.test.ts`, inside `describe('buildNav', …)`, add:

```ts
  it('carries each client folder colour into the tree', () => {
    const coloured = { ...client('acme'), color: 'pink' as const };
    expect(buildNav([coloured], user('admin')).clients[0].color).toBe('pink');
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/components/ClientModal.test.tsx src/nav.test.ts`
Expected: FAIL — no radio named "Purple"; `color` is undefined.

- [ ] **Step 3: Colour in the client form**

In `src/components/ClientModal.tsx`:

Change the imports to:

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { Client, FolderColor } from '../types';
import { DEFAULT_FOLDER_COLOR } from '../folderColors';
import ColorSwatchPicker from './ColorSwatchPicker';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside,
  input, textarea, btnPrimary, btnGhost,
} from '../ui';
```

Add `color: FolderColor;` to `ClientDraft`. After the `about` state add:

```tsx
  const [color, setColor] = useState<FolderColor>(client?.color ?? DEFAULT_FOLDER_COLOR);
```

Change the `onSave` call to:

```tsx
    onSave({ name: name.trim(), imageUrl: imageUrl.trim() || undefined, about: about.trim(), color });
```

Between the Name field's `</div>` and the Profile image URL field, add:

```tsx
          {/* Like picking a folder colour in OneDrive: the colour marks this
              client everywhere it appears. */}
          <div>
            <label className={label}>Folder colour</label>
            <ColorSwatchPicker value={color} onChange={setColor} label="Folder colour" />
          </div>
```

- [ ] **Step 4: Avatars use the colour when there is no picture**

Replace `src/components/ClientAvatar.tsx` with:

```tsx
import { useState } from 'react';
import { folderColorVars, folderTint } from '../folderColors';

interface Props {
  name: string;
  imageUrl?: string;
  /** A folder colour id. Tints the lettered fallback; ignored when the picture loads. */
  color?: string;
  /** Rendered size in pixels. 18 in the nav tree, 22 in the header, 20 in lists. */
  size?: number;
  className?: string;
}

// A client's own picture is far faster to recognise than its initial, and it is
// what makes a workspace feel like *your* workspace. The lettered square is the
// fallback and also covers an image that fails to load; with a folder colour
// set, the square takes that colour, so the choice is visible straight away.
//
// The failure is state rather than a DOM mutation in onError, which React
// could undo on the next render.
export default function ClientAvatar({ name, imageUrl, color, size = 18, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!imageUrl && !failed;
  const tinted = !showImage && !!color;

  return (
    <span
      className={`rounded-tile flex-shrink-0 inline-flex items-center justify-center overflow-hidden ${
        showImage
          ? ''
          : tinted
            ? `${folderTint} font-semibold`
            : 'bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark font-semibold'
      } ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.46)),
        ...(tinted ? folderColorVars(color) : {}),
      }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
```

- [ ] **Step 5: Carry the colour through navigation**

In `src/nav.ts`: change the first import to `import { AppUser, Client, ContentItem, FolderColor } from './types';`, add `color?: FolderColor;` to `NavClient` after `imageUrl?: string;`, and in `buildNav` add `color: c.color,` after `imageUrl: c.imageUrl,`.

In `src/components/Sidebar.tsx`, change the avatar to `<ClientAvatar name={c.name} imageUrl={c.imageUrl} color={c.color} size={18} />`.

In `src/components/AppShell.tsx`, change the breadcrumb avatar to `<ClientAvatar name={activeClient.name} imageUrl={activeClient.imageUrl} color={activeClient.color} size={22} />`.

- [ ] **Step 6: The "Set up businesses" banner on the Clients page**

In `src/pages/ClientsPage.tsx`, add `pendingBusinessMigration, migrateBusinesses,` to the `useClients()` destructuring. After `handleMigrate`, add:

```tsx
  async function handleBusinessMigrate() {
    setMigrating(true);
    await runWrite(async () => {
      const stamped = await migrateBusinesses();
      alert(
        `Every client now has a business. ${stamped} content item${stamped === 1 ? ' was' : 's were'} filed under ${stamped === 1 ? 'its' : 'their'} client's.`
      );
    }, 'set up businesses');
    setMigrating(false);
  }
```

After the "Content needs migrating" banner block, add:

```tsx
      {/* After the content migration, never alongside it: items still in the
          old array are not in the subcollection yet, so they could not be
          filed under a business. */}
      {isAdmin && pendingMigration.length === 0 && pendingBusinessMigration.length > 0 && (
        <div className={banner}>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Set up businesses
          </h2>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/60 mt-1 leading-relaxed">
            A client can now run more than one business, each with its own content and
            campaigns. {pendingBusinessMigration.length} client
            {pendingBusinessMigration.length === 1 ? ' needs' : 's need'} a first business, named
            after the client, with existing content filed under it. Nothing on the boards
            changes, and it is safe to run twice.
          </p>
          <button onClick={handleBusinessMigrate} disabled={migrating} className={bannerBtn}>
            {migrating ? 'Setting up…' : 'Set up businesses'}
          </button>
        </div>
      )}
```

- [ ] **Step 7: Verify**

Run: `npx vitest run src/components/ClientModal.test.tsx src/nav.test.ts` → PASS.
Run: `npx tsc --noEmit` → no output.
Run: `npx vitest run` → all passed.

- [ ] **Step 8: Commit**

```bash
git add src/components/ClientModal.tsx src/components/ClientModal.test.tsx src/components/ClientAvatar.tsx src/nav.ts src/nav.test.ts src/components/Sidebar.tsx src/components/AppShell.tsx src/pages/ClientsPage.tsx
git commit -m "Let a client carry a folder colour, and offer the business migration to admins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Business form

**Files:**
- Create: `src/components/BusinessModal.tsx`
- Test: `src/components/BusinessModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/BusinessModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BusinessModal from './BusinessModal';
import { Business } from '../types';

const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('BusinessModal', () => {
  it('creates a business with the chosen colour', async () => {
    const onSave = vi.fn();
    render(<BusinessModal onClose={vi.fn()} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Bakery');
    await userEvent.click(screen.getByRole('radio', { name: 'Orange' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add business' }));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Bakery', color: 'orange', logoUrl: undefined, about: '',
    });
  });

  it('explains why a business cannot be deleted, and disables the action', () => {
    render(
      <BusinessModal
        business={CAFE}
        deleteBlocker="It still holds 2 content items."
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Delete business/ })).toBeDisabled();
    expect(screen.getByText('It still holds 2 content items.')).toBeInTheDocument();
  });

  it('deletes after confirmation when nothing blocks it', async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BusinessModal business={CAFE} onClose={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /Delete business/ }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('offers no delete while creating', () => {
    render(<BusinessModal onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Delete business/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/BusinessModal.test.tsx`
Expected: FAIL — cannot resolve `./BusinessModal`.

- [ ] **Step 3: Implement**

Create `src/components/BusinessModal.tsx`:

```tsx
import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Business, BusinessDraft, FolderColor } from '../types';
import { DEFAULT_FOLDER_COLOR } from '../folderColors';
import ColorSwatchPicker from './ColorSwatchPicker';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside, hint,
  input, textarea, btnPrimary, btnGhost, btnGhostDanger,
} from '../ui';

interface Props {
  /** Absent when creating. */
  business?: Business;
  /** Why this business cannot be deleted, or null when it can. See businessDeleteBlocker(). */
  deleteBlocker?: string | null;
  onClose: () => void;
  onSave: (draft: BusinessDraft) => void;
  /** Absent when deleting is not offered at all. */
  onDelete?: () => void;
}

// One form for creating and editing, like ClientModal — split, the fields and
// their validation would drift apart.
export default function BusinessModal({
  business, deleteBlocker = null, onClose, onSave, onDelete,
}: Props) {
  const editing = !!business;
  const [name, setName] = useState(business?.name ?? '');
  const [color, setColor] = useState<FolderColor>(business?.color ?? DEFAULT_FOLDER_COLOR);
  const [logoUrl, setLogoUrl] = useState(business?.logoUrl ?? '');
  const [about, setAbout] = useState(business?.about ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color,
      logoUrl: logoUrl.trim() || undefined,
      about: about.trim(),
    });
    onClose();
  }

  function handleDelete() {
    if (!business || !onDelete || deleteBlocker) return;
    if (!confirm(`Delete "${business.name}"? This can't be undone.`)) return;
    onDelete();
    onClose();
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="business-form-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="business-form-title" className={modalTitle}>
            {editing ? 'Edit business' : 'New business'}
          </h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label} htmlFor="business-name">Name</label>
            <input
              id="business-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              required
              autoFocus
              className={input}
            />
          </div>

          <div>
            <label className={label}>Colour</label>
            <ColorSwatchPicker value={color} onChange={setColor} label="Business colour" />
          </div>

          <div>
            <label className={label} htmlFor="business-logo">
              Logo URL <span className={labelAside}>(optional)</span>
            </label>
            <input
              id="business-logo"
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className={input}
            />
          </div>

          <div>
            <label className={label} htmlFor="business-about">
              About <span className={labelAside}>(optional)</span>
            </label>
            <textarea
              id="business-about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="What this business sells, and to whom..."
              rows={3}
              className={textarea}
            />
          </div>

          {editing && onDelete && (
            <div>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!!deleteBlocker}
                className={`${btnGhostDanger} w-full disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Trash2 size={14} />
                Delete business
              </button>
              {deleteBlocker && <p className={hint}>{deleteBlocker}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()} className={`${btnPrimary} flex-1`}>
              {editing ? 'Save changes' : 'Add business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/BusinessModal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/BusinessModal.tsx src/components/BusinessModal.test.tsx
git commit -m "Add the business form, which explains when a business cannot be deleted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Campaign form

**Files:**
- Create: `src/components/CampaignModal.tsx`
- Test: `src/components/CampaignModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/CampaignModal.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignModal from './CampaignModal';
import { Business, Campaign } from '../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('CampaignModal', () => {
  it('hides the business choice when there is only one business', () => {
    render(<CampaignModal businesses={[BAKERY]} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByLabelText('Business')).not.toBeInTheDocument();
  });

  it('saves a campaign with its deliverables', async () => {
    const onSave = vi.fn();
    render(
      <CampaignModal businesses={[BAKERY, CAFE]} defaultBusinessId="b2" onClose={vi.fn()} onSave={onSave} />
    );
    await userEvent.type(screen.getByLabelText('Name'), 'Summer launch');
    await userEvent.click(screen.getByRole('button', { name: 'Live' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add deliverable' }));
    await userEvent.type(screen.getByLabelText('Deliverable 1 name'), 'Reels');
    await userEvent.selectOptions(screen.getByLabelText('Deliverable 1 type'), 'video');
    const count = screen.getByLabelText('Deliverable 1 count');
    await userEvent.clear(count);
    await userEvent.type(count, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b2',
      name: 'Summer launch',
      status: 'live',
      deliverables: [{ id: expect.any(String), label: 'Reels', mediaType: 'video', target: 3 }],
    }));
  });

  it('will not save an end date before the start date', async () => {
    render(<CampaignModal businesses={[BAKERY]} onClose={vi.fn()} onSave={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Backwards');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-03' } });
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled();
    expect(screen.getByText('The end date is before the start date.')).toBeInTheDocument();
  });

  it('keeps existing deliverable ids when editing, so linked content stays linked', async () => {
    const onSave = vi.fn();
    const campaign: Campaign = {
      id: 'c1', businessId: 'b1', name: 'Summer', brief: '', status: 'live', color: 'green',
      deliverables: [{ id: 'd-keep', label: 'Reels', target: 2 }], createdAt: 1,
    };
    render(<CampaignModal campaign={campaign} businesses={[BAKERY]} onClose={vi.fn()} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave.mock.calls[0][0].deliverables).toEqual([{ id: 'd-keep', label: 'Reels', target: 2 }]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/CampaignModal.test.tsx`
Expected: FAIL — cannot resolve `./CampaignModal`.

- [ ] **Step 3: Implement**

Create `src/components/CampaignModal.tsx`:

```tsx
import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import {
  Business, Campaign, CampaignDraft, CampaignStatus, Deliverable, FolderColor, MediaType,
} from '../types';
import { CAMPAIGN_STATUSES, endsBeforeStart } from '../campaigns';
import { generateId } from '../utils';
import ColorSwatchPicker from './ColorSwatchPicker';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside, hint,
  input, textarea, chip, btnPrimary, btnGhost, btnGhostDanger,
} from '../ui';

interface Props {
  /** Absent when creating. */
  campaign?: Campaign;
  businesses: Business[];
  /** Pre-selected business when creating — the workspace's current scope, if any. */
  defaultBusinessId?: string;
  onClose: () => void;
  onSave: (draft: CampaignDraft) => void;
  onDelete?: () => void;
}

// The editor works on strings so a half-typed count does not snap back to a
// number under the cursor; the draft is built from these on save.
interface Row {
  id: string;
  label: string;
  mediaType: MediaType | '';
  target: string;
}

function toRows(deliverables: Deliverable[]): Row[] {
  return deliverables.map((d) => ({
    id: d.id,
    label: d.label,
    mediaType: d.mediaType ?? '',
    target: String(d.target),
  }));
}

export default function CampaignModal({
  campaign, businesses, defaultBusinessId, onClose, onSave, onDelete,
}: Props) {
  const editing = !!campaign;
  const [name, setName] = useState(campaign?.name ?? '');
  const [businessId, setBusinessId] = useState(
    campaign?.businessId ?? defaultBusinessId ?? businesses[0]?.id ?? ''
  );
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status ?? 'planning');
  // Stored days are already the 'YYYY-MM-DD' a date input reads and writes.
  const [start, setStart] = useState(campaign?.startDate ?? '');
  const [end, setEnd] = useState(campaign?.endDate ?? '');
  const [color, setColor] = useState<FolderColor>(campaign?.color ?? 'green');
  const [brief, setBrief] = useState(campaign?.brief ?? '');
  // Existing ids are kept: content points at a deliverable by id, so an edit
  // must not quietly unlink everything filed under it.
  const [rows, setRows] = useState<Row[]>(campaign ? toRows(campaign.deliverables) : []);

  const datesBackwards = endsBeforeStart(start, end);
  const rowsInvalid = rows.some((r) => !r.label.trim() || !(Number(r.target) >= 1));
  const canSave = !!name.trim() && !!businessId && !datesBackwards && !rowsInvalid;

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      businessId,
      name: name.trim(),
      brief: brief.trim(),
      status,
      // An emptied date input is '', which means no date rather than a day.
      startDate: start || undefined,
      endDate: end || undefined,
      color,
      deliverables: rows.map((r) => ({
        id: r.id,
        label: r.label.trim(),
        ...(r.mediaType ? { mediaType: r.mediaType } : {}),
        target: Math.floor(Number(r.target)),
      })),
    });
    onClose();
  }

  function handleDelete() {
    if (!campaign || !onDelete) return;
    const ok = confirm(
      `Delete "${campaign.name}"? Its content stays on the board — it just won't be grouped under this campaign any more.`
    );
    if (!ok) return;
    onDelete();
    onClose();
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="campaign-form-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="campaign-form-title" className={modalTitle}>
            {editing ? 'Edit campaign' : 'New campaign'}
          </h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label} htmlFor="campaign-name">Name</label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer menu launch"
              required
              autoFocus
              className={input}
            />
          </div>

          {businesses.length >= 2 && (
            <div>
              <label className={label} htmlFor="campaign-business">Business</label>
              <select
                id="campaign-business"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className={input}
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {businesses.length === 0 && (
            <p className={hint}>
              This client has no business yet. Run "Set up businesses" on the Clients page first.
            </p>
          )}

          <div>
            <label className={label}>Status</label>
            <div className="grid grid-cols-3 gap-2">
              {CAMPAIGN_STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  aria-pressed={status === s.id}
                  className={chip(status === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="campaign-start">Start</label>
              <input
                id="campaign-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label} htmlFor="campaign-end">End</label>
              <input
                id="campaign-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={input}
              />
            </div>
          </div>
          {datesBackwards && (
            <p className="-mt-2 text-[11px] text-brand dark:text-red-400">
              The end date is before the start date.
            </p>
          )}

          <div>
            <label className={label}>Colour</label>
            <ColorSwatchPicker value={color} onChange={setColor} label="Campaign colour" />
          </div>

          <div>
            <label className={label} htmlFor="campaign-brief">
              Brief <span className={labelAside}>(optional)</span>
            </label>
            <textarea
              id="campaign-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What this campaign is for, who it speaks to, and anything the team should know..."
              rows={3}
              className={textarea}
            />
          </div>

          <div>
            <label className={label}>
              Deliverables <span className={labelAside}>(what the campaign needs)</span>
            </label>
            <div className="flex flex-col gap-2">
              {rows.map((r, index) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input
                    aria-label={`Deliverable ${index + 1} name`}
                    value={r.label}
                    onChange={(e) => updateRow(r.id, { label: e.target.value })}
                    placeholder="Reels"
                    className={`${input} flex-1 min-w-0`}
                  />
                  <select
                    aria-label={`Deliverable ${index + 1} type`}
                    value={r.mediaType}
                    onChange={(e) => updateRow(r.id, { mediaType: e.target.value as MediaType | '' })}
                    className={`${input} w-[96px] px-2`}
                  >
                    <option value="">Any</option>
                    <option value="video">Video</option>
                    <option value="graphic">Graphic</option>
                  </select>
                  <input
                    aria-label={`Deliverable ${index + 1} count`}
                    type="number"
                    min={1}
                    value={r.target}
                    onChange={(e) => updateRow(r.id, { target: e.target.value })}
                    className={`${input} w-[64px] px-2 text-center`}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                    className={`${btnIcon} flex-shrink-0`}
                    aria-label={`Remove deliverable ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setRows((prev) => [...prev, { id: generateId(), label: '', mediaType: '', target: '1' }])
                }
                className={`${btnGhost} h-9 min-h-0 text-[12px]`}
              >
                <Plus size={14} />
                Add deliverable
              </button>
            </div>
            <p className={hint}>
              For example 3 Reels and 2 carousel graphics. Progress fills in as content is linked
              and posted.
            </p>
          </div>

          {editing && onDelete && (
            <button type="button" onClick={handleDelete} className={`${btnGhostDanger} w-full`}>
              <Trash2 size={14} />
              Delete campaign
            </button>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={!canSave} className={`${btnPrimary} flex-1`}>
              {editing ? 'Save changes' : 'Create campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/CampaignModal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/CampaignModal.tsx src/components/CampaignModal.test.tsx
git commit -m "Add the campaign form with a deliverables editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Filing content under a business, campaign and deliverable

**Files:**
- Modify: `src/components/AddContentModal.tsx`
- Test: `src/components/AddContentModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/AddContentModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddContentModal from './AddContentModal';
import { Business, Campaign } from '../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };
const SUMMER: Campaign = {
  id: 'c1', businessId: 'b2', name: 'Summer', brief: '', status: 'live', color: 'green',
  deliverables: [{ id: 'd1', label: 'Carousels', mediaType: 'graphic', target: 2 }], createdAt: 1,
};

function renderModal(props: Partial<React.ComponentProps<typeof AddContentModal>> = {}) {
  const onSubmit = vi.fn();
  render(<AddContentModal defaultStatus="editing" onClose={vi.fn()} onSubmit={onSubmit} {...props} />);
  return onSubmit;
}

describe('AddContentModal — filing', () => {
  it('shows no business or campaign fields for one business without campaigns', () => {
    renderModal({ businesses: [BAKERY], campaigns: [] });
    expect(screen.queryByLabelText('Business')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Campaign/)).not.toBeInTheDocument();
  });

  it("files the item under the campaign's business and the chosen deliverable", async () => {
    const onSubmit = renderModal({ businesses: [BAKERY, CAFE], campaigns: [SUMMER] });
    await userEvent.selectOptions(screen.getByLabelText(/Campaign/), 'c1');
    expect(screen.getByLabelText('Business')).toHaveValue('b2');
    await userEvent.selectOptions(screen.getByLabelText(/Fills/), 'd1');
    await userEvent.type(screen.getByLabelText('Content Title'), 'Menu carousel');
    await userEvent.type(screen.getByLabelText('Drive Link'), 'https://example.com/menu.png');
    await userEvent.click(screen.getByRole('button', { name: 'Add Content' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b2', campaignId: 'c1', deliverableId: 'd1', mediaType: 'graphic',
    }));
  });

  it('drops the campaign when the business changes to one it does not belong to', async () => {
    renderModal({ businesses: [BAKERY, CAFE], campaigns: [SUMMER], defaultCampaignId: 'c1' });
    expect(screen.getByLabelText(/Campaign/)).toHaveValue('c1');
    await userEvent.selectOptions(screen.getByLabelText('Business'), 'b1');
    expect(screen.getByLabelText(/Campaign/)).toHaveValue('');
  });

  it('reports no campaign as null, so an edit can take an item out of one', async () => {
    const onSubmit = renderModal({ businesses: [BAKERY], campaigns: [] });
    await userEvent.type(screen.getByLabelText('Content Title'), 'Plain post');
    await userEvent.type(screen.getByLabelText('Drive Link'), 'https://example.com/x.png');
    await userEvent.click(screen.getByRole('button', { name: 'Add Content' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b1', campaignId: null, deliverableId: null,
    }));
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/AddContentModal.test.tsx`
Expected: FAIL — `Unable to find a label with the text of: Content Title` (the inputs are not labelled yet) and missing campaign fields.

- [ ] **Step 3: Implement**

In `src/components/AddContentModal.tsx`:

3a. Change the `../types` import to:

```tsx
import { Business, Campaign, ContentItem, ContentStatus, MediaType, Platform } from '../types';
```

3b. Replace `interface SubmitData { … }` with an exported, renamed interface, and update the `onSubmit` prop type to use it:

```tsx
export interface ContentFormData {
  title: string;
  driveLink: string;
  driveFileId: string;
  mediaType: MediaType;
  caption?: string;
  hashtags?: string;
  platforms?: Platform[];
  notes?: string;
  status: ContentStatus;
  scheduledAt?: number;
  /** Absent only while the client has no business at all. */
  businessId?: string;
  /** null when the item is in no campaign. */
  campaignId: string | null;
  deliverableId: string | null;
}
```

3c. Add to `Props`, after `existingItem?: ContentItem;`:

```tsx
  /** The client's businesses, oldest first. The picker shows only with two or more. */
  businesses?: Business[];
  /** The client's campaigns. The picker shows only when there are some. */
  campaigns?: Campaign[];
  defaultBusinessId?: string;
  defaultCampaignId?: string;
  defaultDeliverableId?: string;
```

and change `onSubmit: (data: SubmitData) => void;` to `onSubmit: (data: ContentFormData) => void;`.

3d. Change the component signature to:

```tsx
export default function AddContentModal({
  defaultStatus, defaultScheduledAt, defaultTitle, defaultCaption, defaultLink,
  existingItem, businesses = [], campaigns = [],
  defaultBusinessId, defaultCampaignId, defaultDeliverableId,
  onClose, onSubmit,
}: Props) {
```

3e. Replace the `mediaType` state declaration with this block (it must come before `mediaType` is first used):

```tsx
  // A campaign that has since been deleted is treated as none.
  const initialCampaign = campaigns.find(
    (c) => c.id === (existingItem?.campaignId ?? defaultCampaignId)
  );
  const initialDeliverable = initialCampaign?.deliverables.find(
    (d) => d.id === (existingItem?.deliverableId ?? defaultDeliverableId)
  );
  const [campaignId, setCampaignId] = useState(initialCampaign?.id ?? '');
  const [deliverableId, setDeliverableId] = useState(initialDeliverable?.id ?? '');
  // A campaign's business wins: content in a campaign carries its business.
  const [businessId, setBusinessId] = useState(
    initialCampaign?.businessId ?? existingItem?.businessId ?? defaultBusinessId ?? businesses[0]?.id ?? ''
  );
  const [mediaType, setMediaType] = useState<MediaType>(
    existingItem ? mediaTypeOf(existingItem) : initialDeliverable?.mediaType ?? 'video'
  );
```

3f. After `handleDriveLinkChange`, add:

```tsx
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  // With one business (or none yet) every campaign is a candidate.
  const businessCampaigns = campaigns.filter((c) => !businessId || c.businessId === businessId);

  function chooseBusiness(id: string) {
    setBusinessId(id);
    // A campaign belongs to one business; keeping it would file the item
    // under two.
    if (selectedCampaign && selectedCampaign.businessId !== id) {
      setCampaignId('');
      setDeliverableId('');
    }
  }

  function chooseCampaign(id: string) {
    setCampaignId(id);
    setDeliverableId('');
    const campaign = campaigns.find((c) => c.id === id);
    if (campaign) setBusinessId(campaign.businessId);
  }

  function chooseDeliverable(id: string) {
    setDeliverableId(id);
    const deliverable = selectedCampaign?.deliverables.find((d) => d.id === id);
    if (deliverable?.mediaType) {
      setMediaType(deliverable.mediaType);
      setImgError(false);
    }
  }
```

3g. In `handleSubmit`, after `scheduledAt: getScheduledAt(),` add:

```tsx
      ...(businessId ? { businessId } : {}),
      campaignId: campaignId || null,
      deliverableId: (campaignId && deliverableId) || null,
```

3h. Directly after the "Type" field's closing `</div>` (the block containing the Video/Graphic chips), add:

```tsx
          {(businesses.length >= 2 || campaigns.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {businesses.length >= 2 && (
                <div>
                  <label className={label} htmlFor="content-business">Business</label>
                  <select
                    id="content-business"
                    value={businessId}
                    onChange={(e) => chooseBusiness(e.target.value)}
                    className={input}
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {campaigns.length > 0 && (
                <div>
                  <label className={label} htmlFor="content-campaign">
                    Campaign <span className={labelAside}>(optional)</span>
                  </label>
                  <select
                    id="content-campaign"
                    value={campaignId}
                    onChange={(e) => chooseCampaign(e.target.value)}
                    className={input}
                  >
                    <option value="">No campaign</option>
                    {businessCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {selectedCampaign && selectedCampaign.deliverables.length > 0 && (
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="content-deliverable">
                    Fills <span className={labelAside}>(optional)</span>
                  </label>
                  <select
                    id="content-deliverable"
                    value={deliverableId}
                    onChange={(e) => chooseDeliverable(e.target.value)}
                    className={input}
                  >
                    <option value="">Not a planned deliverable</option>
                    {selectedCampaign.deliverables.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
```

3i. Label the title and link inputs (a real accessibility gap, and what lets the test find them): change `<label className={label}>Content Title</label>` to `<label className={label} htmlFor="content-title">Content Title</label>` and add `id="content-title"` to its input; change `<label className={label}>Drive Link</label>` to `<label className={label} htmlFor="content-link">Drive Link</label>` and add `id="content-link"` to its input.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/AddContentModal.test.tsx`
Expected: PASS (4 tests).
Run: `npx tsc --noEmit` → no output. (`ClientBoardPage` still compiles: every new prop is optional, and the extra fields in `ContentFormData` are accepted by `addContent`.)

- [ ] **Step 5: Commit**

```bash
git add src/components/AddContentModal.tsx src/components/AddContentModal.test.tsx
git commit -m "File new content under a business, campaign and deliverable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Campaign label on cards

**Files:**
- Modify: `src/components/ContentCard.tsx`, `src/components/KanbanColumn.tsx`

Covered by the `ContentBoard` test in Task 17 ("labels a card with its campaign").

- [ ] **Step 1: ContentCard takes an optional campaign**

In `src/components/ContentCard.tsx`:

Change the `../types` import to `import { Campaign, ContentItem } from '../types';` and add `import ColorLabel from './ColorLabel';`.

Add to `Props`, after `item: ContentItem;`:

```tsx
  /** The campaign it belongs to, shown as a coloured label. */
  campaign?: Pick<Campaign, 'name' | 'color'>;
```

Add `campaign` to the destructured props. Change the signals condition from

```tsx
          {(reviewBadge || scheduledLabel || platforms.length > 0) && (
```

to

```tsx
          {(campaign || reviewBadge || scheduledLabel || platforms.length > 0) && (
```

and make the campaign label the first child inside that row's `<div className="flex items-center gap-1 mt-1.5 flex-wrap">`:

```tsx
              {/* First, because it says which push this belongs to before the
                  signals say how it is going. Capped so a long campaign name
                  cannot push the review badge to a second line. */}
              {campaign && (
                <ColorLabel color={campaign.color} className="max-w-[120px]">
                  {campaign.name}
                </ColorLabel>
              )}
```

- [ ] **Step 2: KanbanColumn passes it through**

In `src/components/KanbanColumn.tsx`: change the `../types` import to `import { Campaign, ContentItem, ContentStatus } from '../types';`; add to `Props`, after `onDeleteCard`:

```tsx
  /** Looks up the campaign a card belongs to, for its label. */
  campaignOf?: (item: ContentItem) => Campaign | undefined;
```

add `campaignOf,` to the destructured props, and add `campaign={campaignOf?.(item)}` to the `<ContentCard … />` it renders.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → no output.
Run: `npx vitest run` → all passed.

- [ ] **Step 4: Commit**

```bash
git add src/components/ContentCard.tsx src/components/KanbanColumn.tsx
git commit -m "Show a card's campaign as a coloured label

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Extract the kanban into `ContentBoard`

`ClientBoardPage` keeps working until Task 24 replaces it; this task only adds the new component, with the board logic moved over and a campaign filter added.

**Files:**
- Create: `src/components/workspace/ContentBoard.tsx`
- Test: `src/components/workspace/ContentBoard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/workspace/ContentBoard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import ContentBoard from './ContentBoard';
import { Campaign, ContentItem } from '../../types';

// jsdom has no matchMedia. Report a desktop width so the four-column board
// renders rather than the phone's stage tabs.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => localStorage.clear());

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

const SUMMER: Campaign = {
  id: 'c1', businessId: 'b1', name: 'Summer', brief: '', status: 'live', color: 'green',
  deliverables: [], createdAt: 1,
};

function renderBoard(over: Partial<React.ComponentProps<typeof ContentBoard>> = {}) {
  const props = {
    content: [
      item({ id: 'a', title: 'Launch reel', campaignId: 'c1' }),
      item({ id: 'b', title: 'Menu post' }),
    ],
    campaigns: [SUMMER],
    isClientRole: false,
    canAdd: true,
    canEditItem: () => true,
    canDeleteItem: () => true,
    campaignFilter: true,
    onOpen: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    ...over,
  };
  render(<ThemeProvider><ContentBoard {...props} /></ThemeProvider>);
  return props;
}

describe('ContentBoard', () => {
  it('narrows the board to one campaign', async () => {
    renderBoard();
    expect(screen.getByText('Menu post')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Campaign'), 'c1');
    expect(screen.getByText('Launch reel')).toBeInTheDocument();
    expect(screen.queryByText('Menu post')).not.toBeInTheDocument();
  });

  it('can show only the content outside every campaign', async () => {
    renderBoard();
    await userEvent.selectOptions(screen.getByLabelText('Campaign'), 'No campaign');
    expect(screen.queryByText('Launch reel')).not.toBeInTheDocument();
    expect(screen.getByText('Menu post')).toBeInTheDocument();
  });

  it('labels a card with its campaign', () => {
    renderBoard({ campaignFilter: false });
    expect(screen.getByText('Summer')).toBeInTheDocument();
  });

  it('never shows a client the Editing column', () => {
    renderBoard({
      isClientRole: true,
      campaignFilter: false,
      content: [
        item({ id: 'a', title: 'Draft cut', status: 'editing' }),
        item({ id: 'b', title: 'For you', status: 'review' }),
      ],
    });
    expect(screen.queryByText('Draft cut')).not.toBeInTheDocument();
    expect(screen.getByText('For you')).toBeInTheDocument();
    expect(screen.getByText('Needs your review')).toBeInTheDocument();
  });

  it('starts a new item in Editing from the toolbar', async () => {
    const props = renderBoard();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(props.onAdd).toHaveBeenCalledWith('editing');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/workspace/ContentBoard.test.tsx`
Expected: FAIL — cannot resolve `./ContentBoard`.

- [ ] **Step 3: Implement**

Create `src/components/workspace/ContentBoard.tsx`. The stage definitions, `ReadOnlyColumn` and the drag handling are moved from `src/pages/ClientBoardPage.tsx` with their comments; what is new is the campaign filter and that every action is a callback.

```tsx
import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Campaign, ContentItem, ContentStatus } from '../../types';
import KanbanColumn from '../KanbanColumn';
import ContentCard from '../ContentCard';
import StagePill from '../StagePill';
import StageTabs from '../StageTabs';
import BoardFilters from '../BoardFilters';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { STAGES } from '../../utils';
import { NO_CAMPAIGN, scopeContent } from '../../campaigns';
import { ContentFilters, NO_FILTERS, activeFilterCount, filterContent } from '../../filters';
import {
  boardScroller, boardRow, boardColumn, boardSingle, columnHeader, columnBody,
  columnBodyPlain, countChip, pageToolbar, faintText, btnPrimary, toolbarSelect,
} from '../../ui';

// `tab` is the short form for the phone tab strip, where four labels share the
// width. The long label is what the column header shows.
interface StageDef {
  id: ContentStatus;
  label: string;
  tab: string;
}

const TEAM_STAGES: StageDef[] = STAGES.map((s) => ({ id: s.id, label: s.label, tab: s.label }));

// Clients see three stages — 'editing' is internal — and the labels are written
// from their point of view rather than the team's.
const CLIENT_STAGES: StageDef[] = [
  { id: 'review', label: 'Needs your review', tab: 'Your review' },
  { id: 'to-post', label: 'Ready to post', tab: 'Ready' },
  { id: 'posted', label: 'Posted', tab: 'Posted' },
];

const CLIENT_PURPOSE: Record<string, string> = {
  review: 'Nothing is waiting on you right now.',
  'to-post': 'Nothing approved and waiting to go out.',
  posted: 'Nothing has been published yet.',
};

// A client's board is read-only, so it needs no droppable and no sortable —
// same column shell, none of the drag machinery.
function ReadOnlyColumn({
  status,
  label,
  items,
  onCardClick,
  campaignOf,
  filtered = false,
  layout = 'column',
}: {
  status: ContentStatus;
  label: string;
  items: ContentItem[];
  onCardClick: (item: ContentItem) => void;
  campaignOf: (item: ContentItem) => Campaign | undefined;
  filtered?: boolean;
  layout?: 'column' | 'single';
}) {
  const single = layout === 'single';
  return (
    <div className={single ? 'flex-1 min-h-0 flex flex-col' : boardColumn}>
      {!single && (
        <div className={columnHeader}>
          <StagePill status={status} />
          <span className={`text-[12px] font-medium truncate ${faintText}`}>{label}</span>
          <span className={`${countChip} ml-auto`}>{items.length}</span>
        </div>
      )}
      <div className={single ? columnBodyPlain : columnBody}>
        {items.length === 0 ? (
          <div className="flex-1 flex items-start justify-center pt-8 px-4">
            <p className={`text-[12px] leading-relaxed text-center max-w-[26ch] ${faintText}`}>
              {filtered
                ? 'Nothing here matches the current filter.'
                : CLIENT_PURPOSE[status] ?? 'Nothing here right now.'}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              campaign={campaignOf(item)}
              onCardClick={() => onCardClick(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface Props {
  /** Already scoped to the business or campaign being viewed. */
  content: ContentItem[];
  /** Every campaign of the client, for card labels and the filter. */
  campaigns: Campaign[];
  isClientRole: boolean;
  canAdd: boolean;
  canEditItem: (item: ContentItem) => boolean;
  canDeleteItem: (item: ContentItem) => boolean;
  /** Offer the campaign filter. Off inside a campaign, where it has one answer. */
  campaignFilter?: boolean;
  onOpen: (item: ContentItem) => void;
  onAdd: (status: ContentStatus) => void;
  onEdit: (item: ContentItem) => void;
  onMove: (item: ContentItem, status: ContentStatus) => void;
}

export default function ContentBoard({
  content, campaigns, isClientRole, canAdd, canEditItem, canDeleteItem,
  campaignFilter = false, onOpen, onAdd, onEdit, onMove,
}: Props) {
  const [filters, setFilters] = useState<ContentFilters>(NO_FILTERS);
  // '' is every campaign; NO_CAMPAIGN is the content outside all of them.
  const [campaignId, setCampaignId] = useState('');
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [activeStage, setActiveStage] = useState<ContentStatus>(
    isClientRole ? 'review' : 'editing'
  );
  // Must match the condition that renders the draggable board. Gating the
  // handlers more narrowly than the UI is how drag came to look simply dead.
  const canMove = !isClientRole;
  // Captured once per render so a filtered view cannot shift mid-interaction.
  const now = Date.now();
  const showCampaignFilter = campaignFilter && campaigns.length > 0;
  const isFiltered = activeFilterCount(filters) > 0 || campaignId !== '';

  // Below lg the board is a tab strip over one full-width column. Chosen in JS
  // rather than CSS because the two layouts cannot both be mounted: each
  // registers the same droppable and sortable ids.
  const isDesktop = useIsDesktop();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Without this the board is unusable without a pointer.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const campaignOf = (item: ContentItem) =>
    item.campaignId ? campaigns.find((c) => c.id === item.campaignId) : undefined;
  const shown = campaignId ? scopeContent(content, { campaignId }, [], campaigns) : content;

  function itemsIn(status: ContentStatus): ContentItem[] {
    const inStage = shown.filter((item) => item.status === status);
    return filterContent(inStage, filters, now).sort((a, b) => a.createdAt - b.createdAt);
  }

  function handleDragStart(event: DragStartEvent) {
    if (!canMove) return;
    const item = content.find((c) => c.id === event.active.id);
    if (item) setActiveItem(item);
  }

  // The drop target is either a column or one of the cards inside it, since
  // collision detection reports whichever is closest.
  function resolveDropStatus(overId: string): ContentStatus | null {
    const column = TEAM_STAGES.find((col) => col.id === overId);
    if (column) return column.id;
    return content.find((c) => c.id === overId)?.status ?? null;
  }

  // The move belongs on drop. Committing on drag-over reordered the board under
  // the cursor, which fired another drag-over and committed again.
  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    if (!canMove) return;
    const { active, over } = event;
    if (!over) return;
    const target = resolveDropStatus(over.id as string);
    const item = content.find((c) => c.id === active.id);
    if (!target || !item || item.status === target) return;
    onMove(item, target);
  }

  const stages = isClientRole ? CLIENT_STAGES : TEAM_STAGES;
  // A stage the current role cannot see must not leave the phone board showing
  // nothing with no tab selected.
  const currentStage = stages.some((s) => s.id === activeStage) ? activeStage : stages[0].id;
  const tabs = stages.map((s) => ({ id: s.id, label: s.tab, count: itemsIn(s.id).length }));

  function column(stage: StageDef, layout: 'column' | 'single') {
    if (isClientRole) {
      return (
        <ReadOnlyColumn
          key={stage.id}
          status={stage.id}
          label={stage.label}
          items={itemsIn(stage.id)}
          onCardClick={onOpen}
          campaignOf={campaignOf}
          filtered={isFiltered}
          layout={layout}
        />
      );
    }
    return (
      <KanbanColumn
        key={stage.id}
        id={stage.id}
        items={itemsIn(stage.id)}
        canAdd={canAdd}
        canEditItem={canEditItem}
        canDeleteItem={canDeleteItem}
        onAddContent={onAdd}
        onCardClick={onOpen}
        onEditCard={onEdit}
        // Deleting happens in the detail sheet, where it can be confirmed.
        onDeleteCard={onOpen}
        campaignOf={campaignOf}
        filtered={isFiltered}
        layout={layout}
      />
    );
  }

  const current = stages.find((s) => s.id === currentStage) ?? stages[0];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className={pageToolbar}>
        <div className="ml-auto flex items-center gap-1.5 min-w-0">
          {showCampaignFilter && (
            <select
              aria-label="Campaign"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className={toolbarSelect}
            >
              <option value="">All campaigns</option>
              <option value={NO_CAMPAIGN}>No campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <BoardFilters value={filters} onChange={setFilters} />
        </div>
        {canAdd && (
          <button
            onClick={() => onAdd(isDesktop ? 'editing' : currentStage)}
            className={`${btnPrimary} h-9 min-h-0 px-3 text-[12px] flex-shrink-0`}
          >
            <Plus size={14} />
            New
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItem(null)}
      >
        {isDesktop ? (
          <div className={boardScroller}>
            <div className={boardRow}>{stages.map((s) => column(s, 'column'))}</div>
          </div>
        ) : (
          <>
            <StageTabs tabs={tabs} active={currentStage} onChange={setActiveStage} />
            <div className={boardSingle}>{column(current, 'single')}</div>
          </>
        )}

        <DragOverlay>
          {activeItem ? (
            <ContentCard item={activeItem} campaign={campaignOf(activeItem)} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/workspace/ContentBoard.test.tsx`
Expected: PASS (5 tests).
Run: `npx tsc --noEmit` → no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/ContentBoard.tsx src/components/workspace/ContentBoard.test.tsx
git commit -m "Extract the kanban into ContentBoard and add a campaign filter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Extract Today's queue rows for reuse

**Files:**
- Create: `src/components/QueueGroup.tsx`
- Modify: `src/pages/TodayPage.tsx`, `src/today.ts`
- Test: `src/components/QueueGroup.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/QueueGroup.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../contexts/ThemeContext';
import { QUEUE_SECTIONS, QueueGroup } from './QueueGroup';
import { ContentItem } from '../types';
import { TodayEntry } from '../today';

const NOW = new Date('2026-10-03T12:00:00Z').getTime();

function entry(title: string): TodayEntry {
  const item = {
    id: title, title, driveLink: '', driveFileId: '', status: 'review',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending',
  } as ContentItem;
  return { clientId: 'acme', clientName: 'Cafe', clientColor: 'green', item };
}

describe('QueueGroup', () => {
  beforeEach(() => localStorage.clear());

  it('lists each entry under its section and opens the one clicked', async () => {
    const onOpen = vi.fn();
    const e = entry('Menu reel');
    render(
      <ThemeProvider>
        <QueueGroup section={QUEUE_SECTIONS[0]} entries={[e]} now={NOW} onOpen={onOpen} />
      </ThemeProvider>
    );
    expect(screen.getByText('Waiting on a client')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Menu reel — Cafe/ }));
    expect(onOpen).toHaveBeenCalledWith(e);
  });

  it('renders nothing for an empty section', () => {
    const { container } = render(
      <ThemeProvider>
        <QueueGroup section={QUEUE_SECTIONS[0]} entries={[]} now={NOW} onOpen={vi.fn()} />
      </ThemeProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/QueueGroup.test.tsx`
Expected: FAIL — cannot resolve `./QueueGroup`.

- [ ] **Step 3: Carry the colour on queue entries**

In `src/today.ts`: change the import to `import { Client, ContentItem, FolderColor } from './types';`, add to `TodayEntry` after `clientImageUrl?: string;`:

```ts
  /** Tints the lettered avatar when there is no picture. */
  clientColor?: FolderColor;
```

and in `entries()`, after `clientImageUrl: c.imageUrl,` add `clientColor: c.color,`.

- [ ] **Step 4: Move the queue rows into `src/components/QueueGroup.tsx`**

Create `src/components/QueueGroup.tsx` from code moved out of `src/pages/TodayPage.tsx`: the `Section` interface (renamed `QueueSection`, exported), `SECTIONS` (renamed `QUEUE_SECTIONS`, exported), `Row` (renamed `QueueRow`, exported) and `Group` (renamed `QueueGroup`, exported, rendering `QueueRow`). Keep every comment. The only behavioural change is the avatar's colour. The file:

```tsx
import { Clock, RotateCcw, CalendarClock, CalendarPlus } from 'lucide-react';
import { TodayEntry, TodayGroups, slotLabel } from '../today';
import StagePill from './StagePill';
import ClientAvatar from './ClientAvatar';
import { faintText, rowList, queueRow, countChip, sectionLabel } from '../ui';

export interface QueueSection {
  key: keyof TodayGroups;
  id: string;
  label: string;
  hint: string;
  icon: typeof Clock;
}

export const QUEUE_SECTIONS: QueueSection[] = [
  {
    key: 'waitingOnClient', id: 'waiting', label: 'Waiting on a client', icon: Clock,
    hint: 'Sitting in Review with no decision yet.',
  },
  {
    key: 'needsRework', id: 'rework', label: 'Needs rework', icon: RotateCcw,
    hint: 'Declined, and not yet replaced.',
  },
  {
    key: 'goingOutSoon', id: 'soon', label: 'Going out soon', icon: CalendarClock,
    hint: 'Booked inside the next week, or already slipped.',
  },
  {
    key: 'readyToSchedule', id: 'schedule', label: 'Ready to schedule', icon: CalendarPlus,
    hint: 'Approved, but with no slot booked.',
  },
];

// A row is deliberately dense: this is a queue you scan, not a gallery. The
// title owns the width — it is the only thing on the row that identifies the
// work — and the client name moved under it, because a fixed 112px column of
// "Mortgage Superh…" repeated eleven times was the loudest thing on the page
// and told you the least.
export function QueueRow({ entry, now, onOpen }: { entry: TodayEntry; now: number; onOpen: () => void }) {
  const slot = slotLabel(entry.item.scheduledAt, now);
  // Something already posted cannot be late, however old its slot.
  const late = !!slot?.late && entry.item.status !== 'posted';
  const when = entry.item.scheduledAt
    ? new Date(entry.item.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <button
      onClick={onOpen}
      className={queueRow}
      // Spelled out because the row's text is split across nested spans, which
      // left the button with no computed name in the accessibility tree.
      aria-label={`${entry.item.title} — ${entry.clientName}${slot ? `, ${slot.text}` : ''}`}
    >
      <ClientAvatar
        name={entry.clientName}
        imageUrl={entry.clientImageUrl}
        color={entry.clientColor}
        size={22}
      />

      <span className="flex-1 min-w-0">
        <span className="block text-[13px] leading-snug text-ink dark:text-ink-dark truncate">
          {entry.item.title}
        </span>
        {/* Flex, not one truncating line: the client name is the part that may
            be cut, and "2 months late" is the part that must not be. */}
        <span className={`flex items-center text-[11px] leading-snug min-w-0 ${faintText}`}>
          <span className="truncate">{entry.clientName}</span>
          {slot && (
            <>
              <span className="mx-1.5 opacity-50 flex-shrink-0">·</span>
              {/* "2 months late" says what a red date only implied. */}
              <span
                className={`flex-shrink-0 ${late ? 'text-brand dark:text-red-400 font-medium' : ''}`}
              >
                {slot.text}
              </span>
            </>
          )}
        </span>
      </span>

      {/* The exact date is the same fact as the relative label beside the client
          name, so a phone shows one of the two and gives the width to the title
          instead. */}
      {when && (
        <span
          className={`hidden sm:block text-[11px] font-medium tabular-nums flex-shrink-0 ${
            late ? 'text-brand dark:text-red-400' : faintText
          }`}
        >
          {when}
        </span>
      )}
      {/* The stage used to be hidden below sm, which left a phone row showing no
          stage at all — the one signal that says whose move it is. */}
      <span className="flex-shrink-0">
        <StagePill status={entry.item.status} />
      </span>
    </button>
  );
}

export function QueueGroup({
  section, entries, now, onOpen,
}: {
  section: QueueSection;
  entries: TodayEntry[];
  now: number;
  onOpen: (e: TodayEntry) => void;
}) {
  if (entries.length === 0) return null;
  const { icon: Icon } = section;
  return (
    <section id={section.id} className="mb-6 scroll-mt-4">
      {/* One line, not three. The label, the count and the explanation used to
          occupy a stacked header taller than two of the rows beneath it. */}
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <Icon size={13} className={faintText} />
        <span className={sectionLabel}>{section.label}</span>
        <span className={countChip}>{entries.length}</span>
        <span className={`hidden md:block text-[11px] truncate ${faintText}`}>{section.hint}</span>
      </div>
      <div className={rowList}>
        {entries.map((e) => (
          <QueueRow key={`${e.clientId}-${e.item.id}`} entry={e} now={now} onOpen={() => onOpen(e)} />
        ))}
      </div>
    </section>
  );
}
```

In `src/pages/TodayPage.tsx`: delete the `Section` interface, `SECTIONS`, `Row` and `Group`; add `import { QUEUE_SECTIONS, QueueGroup } from '../components/QueueGroup';`; replace each `SECTIONS` with `QUEUE_SECTIONS` and `<Group` with `<QueueGroup`. Trim the now-unused imports so the top of the file reads:

```tsx
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { buildToday, TodayEntry, todayTotal } from '../today';
import { QUEUE_SECTIONS, QueueGroup } from '../components/QueueGroup';
import { shell, heading, faintText, card, emptyState, emptyTitle, emptyBody } from '../ui';
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/components/QueueGroup.test.tsx` → PASS (2 tests).
Run: `npx tsc --noEmit` → no output (an unused-import error here means Step 4's trim was incomplete).
Run: `npx vitest run` → all passed.

- [ ] **Step 6: Commit**

```bash
git add src/components/QueueGroup.tsx src/components/QueueGroup.test.tsx src/pages/TodayPage.tsx src/today.ts
git commit -m "Extract Today's queue rows so the client Overview can reuse them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Workspace tabs, menu and business scope bar

**Files:**
- Create: `src/components/workspace/WorkspaceTabs.tsx`, `src/components/workspace/WorkspaceMenu.tsx`, `src/components/workspace/BusinessScopeBar.tsx`
- Test: `src/components/workspace/WorkspaceChrome.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/workspace/WorkspaceChrome.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTabs from './WorkspaceTabs';
import WorkspaceMenu from './WorkspaceMenu';
import BusinessScopeBar from './BusinessScopeBar';
import { tabsFor } from '../../workspace';
import { Business } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('WorkspaceTabs', () => {
  it('marks the active tab and reports the one chosen', async () => {
    const onSelect = vi.fn();
    render(<WorkspaceTabs tabs={tabsFor('admin')} active="content" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(onSelect).toHaveBeenCalledWith('campaigns');
  });

  it('shows a client only their three tabs', () => {
    render(<WorkspaceTabs tabs={tabsFor('client')} active="content" onSelect={vi.fn()} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Content', 'Calendar', 'Ideas']);
  });
});

describe('WorkspaceMenu', () => {
  it('runs the chosen action and closes', async () => {
    const onAddBusiness = vi.fn();
    render(<WorkspaceMenu onEditClient={vi.fn()} onAddBusiness={onAddBusiness} onNewCampaign={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add business' }));
    expect(onAddBusiness).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('leaves out actions that are not available yet', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit client']);
  });

  it('closes on Escape', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('BusinessScopeBar', () => {
  it('renders nothing for a single business', () => {
    const { container } = render(
      <BusinessScopeBar businesses={[BAKERY]} value={undefined} onChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers all businesses and each one, marking the current scope', async () => {
    const onChange = vi.fn();
    render(<BusinessScopeBar businesses={[BAKERY, CAFE]} value="b2" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Cafe' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All businesses' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'All businesses' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Bakery' }));
    expect(onChange).toHaveBeenCalledWith('b1');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/workspace/WorkspaceChrome.test.tsx`
Expected: FAIL — cannot resolve `./WorkspaceTabs`.

- [ ] **Step 3: Implement the three components**

Create `src/components/workspace/WorkspaceTabs.tsx`:

```tsx
import { ReactNode } from 'react';
import { TabDef, WorkspaceTab } from '../../workspace';
import { workspaceTab, workspaceTabList, workspaceTabRow } from '../../ui';

interface Props {
  tabs: TabDef[];
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  /** Right-aligned controls, outside the scrolling list so a menu can drop out of the bar. */
  actions?: ReactNode;
}

// A client's places, in one row under the breadcrumb. They replace the old
// Board / Calendar / Ideas switch, which lived in the board's own toolbar and so
// could not hold anything that was not a view of the board.
export default function WorkspaceTabs({ tabs, active, onSelect, actions }: Props) {
  return (
    <div className={workspaceTabRow}>
      <div role="tablist" aria-label="Client workspace" className={workspaceTabList}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            onClick={() => onSelect(t.id)}
            className={workspaceTab(t.id === active)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {actions && <div className="flex items-center flex-shrink-0">{actions}</div>}
    </div>
  );
}
```

Create `src/components/workspace/WorkspaceMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Building2, Megaphone } from 'lucide-react';
import { btnIcon, card } from '../../ui';

interface Props {
  onEditClient: () => void;
  /** Absent until the client has its first business, so a new one cannot swallow old content. */
  onAddBusiness?: () => void;
  /** Absent for the same reason: a campaign needs a business to belong to. */
  onNewCampaign?: () => void;
}

const menuItem =
  'w-full flex items-center gap-2 h-8 px-2 rounded-tile text-[13px] text-left text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark transition-colors focus:outline-none focus-visible:bg-hover dark:focus-visible:bg-hover-dark';

export default function WorkspaceMenu({ onEditClient, onAddBusiness, onNewCampaign }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Same dismissal as the board filters: an outside press or Escape. A menu
  // that only its own trigger can close is a trap.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${btnIcon} w-8 h-8`}
        aria-label="Client actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className={`${card} absolute right-0 top-full mt-1 z-30 w-48 p-1 shadow-lift`}>
          {onNewCampaign && (
            <button role="menuitem" onClick={() => run(onNewCampaign)} className={menuItem}>
              <Megaphone size={14} />
              New campaign
            </button>
          )}
          {onAddBusiness && (
            <button role="menuitem" onClick={() => run(onAddBusiness)} className={menuItem}>
              <Building2 size={14} />
              Add business
            </button>
          )}
          <button role="menuitem" onClick={() => run(onEditClient)} className={menuItem}>
            <Pencil size={14} />
            Edit client
          </button>
        </div>
      )}
    </div>
  );
}
```

Create `src/components/workspace/BusinessScopeBar.tsx`:

```tsx
import { Business } from '../../types';
import { folderColor } from '../../folderColors';
import { scopeChip } from '../../ui';

interface Props {
  businesses: Business[];
  /** The business the workspace is scoped to, or undefined for all of them. */
  value: string | undefined;
  onChange: (businessId: string | undefined) => void;
}

// With one business there is nothing to choose, so this renders nothing and a
// single-business client looks exactly as it did before businesses existed.
// The colour dot is never the only cue: every chip carries the business name.
export default function BusinessScopeBar({ businesses, value, onChange }: Props) {
  if (businesses.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Business"
      className="flex items-center gap-1 px-4 h-10 flex-shrink-0 border-b border-hairline dark:border-hairline-dark overflow-x-auto [scrollbar-width:none]"
    >
      <button onClick={() => onChange(undefined)} aria-pressed={!value} className={scopeChip(!value)}>
        All businesses
      </button>
      {businesses.map((b) => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          aria-pressed={value === b.id}
          className={scopeChip(value === b.id)}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: folderColor(b.color).swatch }}
            aria-hidden="true"
          />
          {b.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/workspace/WorkspaceChrome.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/WorkspaceTabs.tsx src/components/workspace/WorkspaceMenu.tsx src/components/workspace/BusinessScopeBar.tsx src/components/workspace/WorkspaceChrome.test.tsx
git commit -m "Add the workspace tab bar, actions menu and business scope chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Campaign cards and the Campaigns tab

**Files:**
- Create: `src/components/workspace/CampaignCard.tsx`, `src/components/workspace/CampaignsTab.tsx`
- Test: `src/components/workspace/CampaignsTab.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/workspace/CampaignsTab.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignsTab from './CampaignsTab';
import { Business, Campaign, CampaignStatus, ContentItem } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };

function campaign(id: string, name: string, status: CampaignStatus, over: Partial<Campaign> = {}): Campaign {
  return {
    id, businessId: 'b1', name, brief: '', status, color: 'green', deliverables: [], createdAt: 1, ...over,
  };
}

function renderTab(over: Partial<React.ComponentProps<typeof CampaignsTab>> = {}) {
  const props = {
    campaigns: [campaign('c3', 'Done', 'completed'), campaign('c2', 'Plan', 'planning'), campaign('c1', 'Now', 'live')],
    content: [] as ContentItem[],
    businesses: [BAKERY],
    canManage: true,
    onOpen: vi.fn(),
    onNew: vi.fn(),
    ...over,
  };
  render(<CampaignsTab {...props} />);
  return props;
}

describe('CampaignsTab', () => {
  it('groups campaigns live, then planning, then completed', () => {
    renderTab();
    const groups = screen.getAllByRole('region');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Live', 'Planning', 'Completed']);
    expect(within(groups[0]).getByText('Now')).toBeInTheDocument();
  });

  it('shows deliverable progress on the card', () => {
    const summer = campaign('c1', 'Summer', 'live', {
      deliverables: [{ id: 'd1', label: 'Reels', target: 3 }],
    });
    const posted = {
      id: 'r1', title: 'Reel', driveLink: '', driveFileId: '', status: 'posted', createdAt: 1,
      uploadedByEmail: 'a@b.c', clientReview: 'approved', campaignId: 'c1', deliverableId: 'd1',
    } as ContentItem;
    renderTab({ campaigns: [summer], content: [posted] });
    expect(screen.getByText('1 of 3 posted')).toBeInTheDocument();
    expect(screen.getByText('Reels 1/3')).toBeInTheDocument();
  });

  it('opens a campaign from its card', async () => {
    const props = renderTab();
    await userEvent.click(screen.getByText('Now'));
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('offers New campaign only to the team', () => {
    renderTab({ canManage: false });
    expect(screen.queryByRole('button', { name: 'New campaign' })).not.toBeInTheDocument();
  });

  it('explains campaigns when there are none', () => {
    renderTab({ campaigns: [] });
    expect(screen.getByText('No campaigns yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/workspace/CampaignsTab.test.tsx`
Expected: FAIL — cannot resolve `./CampaignsTab`.

- [ ] **Step 3: Implement**

Create `src/components/workspace/CampaignCard.tsx`:

```tsx
import { CalendarDays } from 'lucide-react';
import { Campaign, ContentItem } from '../../types';
import {
  campaignProgress, campaignStatusMeta, deliverableProgress, formatDateRange,
} from '../../campaigns';
import { folderColor } from '../../folderColors';
import ColorLabel from '../ColorLabel';
import ProgressBar from '../ProgressBar';
import { cardInteractive, faintText, heading } from '../../ui';

interface Props {
  campaign: Campaign;
  /** The client's content. The card picks out its own. */
  content: ContentItem[];
  /** Set when the client has several businesses, so the card says whose it is. */
  businessName?: string;
  onOpen: () => void;
}

export default function CampaignCard({ campaign, content, businessName, onOpen }: Props) {
  const progress = campaignProgress(campaign, content);
  const slots = deliverableProgress(campaign, content);
  const status = campaignStatusMeta(campaign.status);
  const dates = formatDateRange(campaign.startDate, campaign.endDate);
  const summary = `${progress.posted} of ${progress.planned} posted`;

  return (
    <button
      onClick={onOpen}
      className={`${cardInteractive} w-full text-left overflow-hidden flex focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30`}
    >
      {/* The campaign's colour as a spine, the way a coloured tab marks a binder. */}
      <span
        className="w-1 flex-shrink-0"
        style={{ backgroundColor: folderColor(campaign.color).swatch }}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 p-3.5 flex flex-col gap-2">
        <span className="flex items-start gap-2">
          <span className={`${heading} text-[14px] leading-snug flex-1 min-w-0 line-clamp-2`}>
            {campaign.name}
          </span>
          <ColorLabel color={status.color}>{status.label}</ColorLabel>
        </span>

        {(dates || businessName) && (
          <span className={`flex items-center gap-1.5 text-[11px] min-w-0 ${faintText}`}>
            {dates && <CalendarDays size={11} className="flex-shrink-0" />}
            {dates && <span className="flex-shrink-0">{dates}</span>}
            {dates && businessName && <span className="opacity-50">·</span>}
            {businessName && <span className="truncate">{businessName}</span>}
          </span>
        )}

        <span className="flex flex-col gap-1">
          <ProgressBar value={progress.ratio} color={campaign.color} label={summary} />
          <span className={`text-[11px] tabular-nums ${faintText}`}>
            {progress.planned === 0 ? 'No deliverables planned yet' : summary}
          </span>
        </span>

        {slots.length > 0 && (
          <span className={`text-[11px] leading-relaxed line-clamp-2 ${faintText}`}>
            {slots.map((s) => `${s.deliverable.label} ${s.posted}/${s.planned}`).join(' · ')}
          </span>
        )}
      </span>
    </button>
  );
}
```

Create `src/components/workspace/CampaignsTab.tsx`:

```tsx
import { Megaphone, Plus } from 'lucide-react';
import { Business, Campaign, ContentItem } from '../../types';
import { CAMPAIGN_GROUP_ORDER, campaignStatusMeta, sortCampaigns } from '../../campaigns';
import CampaignCard from './CampaignCard';
import {
  shell, heading, faintText, card, btnPrimary, sectionLabel, countChip,
  emptyState, emptyTitle, emptyBody,
} from '../../ui';

interface Props {
  /** Already scoped to the current business, if there is one. */
  campaigns: Campaign[];
  /** The client's content; each card picks out its own. */
  content: ContentItem[];
  businesses: Business[];
  canManage: boolean;
  onOpen: (campaign: Campaign) => void;
  onNew: () => void;
}

export default function CampaignsTab({ campaigns, content, businesses, canManage, onOpen, onNew }: Props) {
  const sorted = sortCampaigns(campaigns);
  const multi = businesses.length >= 2;
  const nameOf = (id: string) => businesses.find((b) => b.id === id)?.name;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shell} py-6 max-w-[1100px]`}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className={`${heading} text-lg`}>Campaigns</h1>
            <p className={`text-[13px] mt-0.5 ${faintText}`}>
              {campaigns.length === 0
                ? 'Group the content a push needs, and see what is still missing.'
                : `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {canManage && (
            <button onClick={onNew} className={`${btnPrimary} h-9 min-h-0 px-3 text-[12px] flex-shrink-0`}>
              <Plus size={14} />
              New campaign
            </button>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className={emptyState}>
            <div className={`${card} w-12 h-12 flex items-center justify-center`}>
              <Megaphone size={20} className={faintText} />
            </div>
            <p className={emptyTitle}>No campaigns yet</p>
            <p className={emptyBody}>
              A campaign is a launch, a season or a promotion: a brief, a date range, and the
              pieces of content it needs.
            </p>
          </div>
        ) : (
          CAMPAIGN_GROUP_ORDER.map((status) => {
            const group = sorted.filter((c) => c.status === status);
            if (group.length === 0) return null;
            const meta = campaignStatusMeta(status);
            return (
              <section key={status} aria-label={meta.label} className="mb-7">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={sectionLabel}>{meta.label}</span>
                  <span className={countChip}>{group.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map((c) => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      content={content}
                      businessName={multi ? nameOf(c.businessId) : undefined}
                      onOpen={() => onOpen(c)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/workspace/CampaignsTab.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/CampaignCard.tsx src/components/workspace/CampaignsTab.tsx src/components/workspace/CampaignsTab.test.tsx
git commit -m "Add campaign cards and the Campaigns tab, grouped by status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Business cards and the Overview tab

**Files:**
- Create: `src/components/workspace/BusinessCard.tsx`, `src/components/workspace/OverviewTab.tsx`
- Test: `src/components/workspace/OverviewTab.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/workspace/OverviewTab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import OverviewTab from './OverviewTab';
import { Business, Client, ContentItem } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(businesses: Business[], content: ContentItem[] = []): Client {
  return { id: 'acme', name: 'Acme', about: '', content, businesses, createdAt: 1 };
}

function renderOverview(c: Client) {
  const props = {
    client: c,
    content: c.content,
    campaigns: [],
    allCampaigns: [],
    businessId: undefined,
    canManage: true,
    onSelectBusiness: vi.fn(),
    onEditBusiness: vi.fn(),
    onAddBusiness: vi.fn(),
    onOpenItem: vi.fn(),
    onOpenCampaign: vi.fn(),
  };
  render(<ThemeProvider><OverviewTab {...props} /></ThemeProvider>);
  return props;
}

describe('OverviewTab', () => {
  beforeEach(() => localStorage.clear());

  it('shows no business layer for a single business', () => {
    renderOverview(client([BAKERY]));
    expect(screen.queryByRole('region', { name: 'Businesses' })).not.toBeInTheDocument();
  });

  it('shows a card per business and scopes to the one pressed', async () => {
    const props = renderOverview(client([BAKERY, CAFE]));
    expect(screen.getByRole('region', { name: 'Businesses' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Cafe/ }));
    expect(props.onSelectBusiness).toHaveBeenCalledWith('b2');
  });

  it('lists work waiting on the client under its business, and opens it', async () => {
    const waiting = item({ id: 'w', title: 'Menu reel', status: 'review', businessId: 'b2' });
    const props = renderOverview(client([BAKERY, CAFE], [waiting]));
    await userEvent.click(screen.getByRole('button', { name: /Menu reel — Cafe/ }));
    expect(props.onOpenItem).toHaveBeenCalledWith(waiting);
  });

  it('says so when nothing needs attention', () => {
    renderOverview(client([BAKERY]));
    expect(screen.getByText(/Nothing needs attention/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/workspace/OverviewTab.test.tsx`
Expected: FAIL — cannot resolve `./OverviewTab`.

- [ ] **Step 3: Implement**

Create `src/components/workspace/BusinessCard.tsx`:

```tsx
import { Pencil } from 'lucide-react';
import { Business } from '../../types';
import { BusinessSummary } from '../../campaigns';
import ClientAvatar from '../ClientAvatar';
import ColorLabel from '../ColorLabel';
import { btnIcon, cardInteractive, faintText, heading } from '../../ui';

interface Props {
  business: Business;
  summary: BusinessSummary;
  /** True when the workspace is scoped to this business. */
  selected: boolean;
  canManage: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Two sibling buttons, not one inside the other (invalid HTML): the card scopes
// the workspace to this business, the pencil edits it. The pencil is always
// visible below lg, where there is no hover to reveal it.
export default function BusinessCard({ business, summary, selected, canManage, onSelect, onEdit }: Props) {
  return (
    <div
      className={`group relative ${cardInteractive} ${
        selected ? '!bg-tint dark:!bg-tint-dark !border-ink-faint/50 dark:!border-ink-faintdark/50' : ''
      }`}
    >
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full text-left p-3.5 pr-12 flex items-start gap-3 rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        <ClientAvatar name={business.name} imageUrl={business.logoUrl} color={business.color} size={36} />
        <span className="flex-1 min-w-0">
          <span className={`${heading} block text-[14px] truncate`}>{business.name}</span>
          <span className={`block text-[11px] mt-0.5 ${faintText}`}>
            {plural(summary.total, 'item')}
            {summary.activeCampaigns > 0 && ` · ${plural(summary.activeCampaigns, 'active campaign')}`}
          </span>
          {summary.awaitingReview > 0 && (
            <span className="flex mt-2">
              <ColorLabel color="sky">{summary.awaitingReview} awaiting review</ColorLabel>
            </span>
          )}
        </span>
      </button>
      {canManage && (
        <button
          onClick={onEdit}
          // btnIcon's own 36px, not a smaller override: a w-7 written after it
          // would lose anyway (Tailwind orders same-property utilities itself),
          // and 36px is the better target on a phone. pr-12 above keeps the
          // name clear of it.
          className={`${btnIcon} absolute top-2 right-2 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100`}
          aria-label={`Edit ${business.name}`}
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
```

Create `src/components/workspace/OverviewTab.tsx`:

```tsx
import { Plus } from 'lucide-react';
import { Business, Campaign, Client, ContentItem } from '../../types';
import { businessIdOf, businessSummary, sortCampaigns } from '../../campaigns';
import { buildToday, todayTotal } from '../../today';
import { STAGES } from '../../utils';
import { QUEUE_SECTIONS, QueueGroup } from '../QueueGroup';
import StagePill from '../StagePill';
import BusinessCard from './BusinessCard';
import CampaignCard from './CampaignCard';
import { shell, heading, faintText, tile, sectionLabel, countChip } from '../../ui';

interface Props {
  client: Client;
  /** The client's content, scoped to the current business if there is one. */
  content: ContentItem[];
  /** Campaigns, scoped the same way. */
  campaigns: Campaign[];
  /** Every campaign of the client, for the business cards' counts. */
  allCampaigns: Campaign[];
  businessId: string | undefined;
  canManage: boolean;
  onSelectBusiness: (businessId: string | undefined) => void;
  onEditBusiness: (business: Business) => void;
  onAddBusiness: () => void;
  onOpenItem: (item: ContentItem) => void;
  onOpenCampaign: (campaign: Campaign) => void;
}

// The tab that answers "how is this client doing?" without opening anything:
// which business, what stage everything is at, what is waiting, what is running.
export default function OverviewTab({
  client, content, campaigns, allCampaigns, businessId, canManage,
  onSelectBusiness, onEditBusiness, onAddBusiness, onOpenItem, onOpenCampaign,
}: Props) {
  const businesses = client.businesses;
  const multi = businesses.length >= 2;
  const now = Date.now();

  // Today's queue, reused. With several businesses each row names its business
  // rather than the client, whose name would be the same on every row.
  const sources: Client[] = multi
    ? businesses.map((b) => ({
        ...client,
        name: b.name,
        imageUrl: b.logoUrl,
        color: b.color,
        content: content.filter((i) => businessIdOf(i, businesses) === b.id),
      }))
    : [{ ...client, content }];
  const groups = buildToday(sources, now);
  const waiting = todayTotal(groups);

  const active = sortCampaigns(campaigns.filter((c) => c.status !== 'completed'));
  // Only worth saying whose campaign it is when the view spans businesses.
  const businessName = (id: string) =>
    multi && !businessId ? businesses.find((b) => b.id === id)?.name : undefined;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shell} py-6 max-w-[1100px] flex flex-col gap-7`}>
        {multi && (
          <section aria-label="Businesses">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={sectionLabel}>Businesses</span>
              <span className={countChip}>{businesses.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {businesses.map((b) => (
                <BusinessCard
                  key={b.id}
                  business={b}
                  summary={businessSummary(b.id, businesses, client.content, allCampaigns)}
                  selected={businessId === b.id}
                  canManage={canManage}
                  // Pressing the business already in scope widens back to all.
                  onSelect={() => onSelectBusiness(businessId === b.id ? undefined : b.id)}
                  onEdit={() => onEditBusiness(b)}
                />
              ))}
              {canManage && (
                <button
                  onClick={onAddBusiness}
                  className="min-h-[76px] rounded-card border border-dashed border-hairline dark:border-hairline-dark inline-flex items-center justify-center gap-2 text-[13px] font-medium text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-tint dark:hover:bg-tint-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  <Plus size={15} />
                  Add business
                </button>
              )}
            </div>
          </section>
        )}

        <section aria-label="Pipeline" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAGES.map((s) => (
            <div key={s.id} className={`${tile} p-3.5`}>
              <StagePill status={s.id} />
              <p className={`${heading} text-2xl mt-2 tabular-nums`}>
                {content.filter((i) => i.status === s.id).length}
              </p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-7 items-start">
          <div>
            {waiting === 0 ? (
              <p className={`px-1 text-[13px] ${faintText}`}>
                Nothing needs attention: no review waiting, nothing declined, nothing due this week.
              </p>
            ) : (
              QUEUE_SECTIONS.map((section) => (
                <QueueGroup
                  key={section.id}
                  section={section}
                  entries={groups[section.key]}
                  now={now}
                  onOpen={(entry) => onOpenItem(entry.item)}
                />
              ))
            )}
          </div>

          <section aria-label="Active campaigns">
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className={sectionLabel}>Active campaigns</span>
              <span className={countChip}>{active.length}</span>
            </div>
            {active.length === 0 ? (
              <p className={`px-1 text-[12px] ${faintText}`}>
                Nothing planned or live{canManage ? '. Start one from the Campaigns tab.' : '.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {active.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    content={client.content}
                    businessName={businessName(c.businessId)}
                    onOpen={() => onOpenCampaign(c)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/workspace/OverviewTab.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/BusinessCard.tsx src/components/workspace/OverviewTab.tsx src/components/workspace/OverviewTab.test.tsx
git commit -m "Add the client Overview: businesses, pipeline, attention queue and active campaigns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: The campaign page

**Files:**
- Create: `src/components/workspace/CampaignPage.tsx`
- Test: `src/components/workspace/CampaignPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/workspace/CampaignPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import CampaignPage from './CampaignPage';
import { Business, Campaign, ContentItem } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };

const SUMMER: Campaign = {
  id: 'c1', businessId: 'b1', name: 'Summer launch', brief: 'Push the new menu.', status: 'live',
  color: 'green', deliverables: [{ id: 'd1', label: 'Reels', mediaType: 'video', target: 3 }], createdAt: 1,
};

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

const CONTENT = [
  item({ id: 'r1', title: 'Reel one', campaignId: 'c1', deliverableId: 'd1', status: 'posted' }),
  item({ id: 'x', title: 'Loose post', campaignId: 'c1' }),
  item({ id: 'y', title: 'Elsewhere' }),
];

function renderPage(over: Partial<React.ComponentProps<typeof CampaignPage>> = {}) {
  const props = {
    campaign: SUMMER,
    content: CONTENT,
    businesses: [BAKERY],
    campaigns: [SUMMER],
    canManage: true,
    canEditItem: () => true,
    canDeleteItem: () => true,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onSetStatus: vi.fn(),
    onOpenItem: vi.fn(),
    onAddContent: vi.fn(),
    onEditItem: vi.fn(),
    onMoveItem: vi.fn(),
    ...over,
  };
  render(<ThemeProvider><CampaignPage {...props} /></ThemeProvider>);
  return props;
}

describe('CampaignPage', () => {
  beforeEach(() => localStorage.clear());

  it('shows the brief, each deliverable with its progress, and unslotted content', () => {
    renderPage();
    expect(screen.getByText('Push the new menu.')).toBeInTheDocument();
    expect(screen.getByText('1/3 posted')).toBeInTheDocument();
    expect(screen.getByText('Reel one')).toBeInTheDocument();
    expect(screen.getByText('Loose post')).toBeInTheDocument();
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument();
  });

  it('adds content straight into a deliverable', async () => {
    const props = renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Add to Reels' }));
    expect(props.onAddContent).toHaveBeenCalledWith({ status: 'editing', deliverableId: 'd1' });
  });

  it('changes status from the header', async () => {
    const props = renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'completed');
    expect(props.onSetStatus).toHaveBeenCalledWith('completed');
  });

  it('hides editing controls from someone who cannot manage campaigns', () => {
    renderPage({ canManage: false });
    expect(screen.queryByRole('button', { name: 'Add to Reels' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/workspace/CampaignPage.test.tsx`
Expected: FAIL — cannot resolve `./CampaignPage`.

- [ ] **Step 3: Implement**

Create `src/components/workspace/CampaignPage.tsx`:

```tsx
import { useState } from 'react';
import { ArrowLeft, LayoutGrid, ListChecks, Pencil, Plus } from 'lucide-react';
import { Business, Campaign, CampaignStatus, ContentItem, ContentStatus } from '../../types';
import {
  CAMPAIGN_STATUSES, DeliverableProgress, campaignProgress, campaignStatusMeta,
  deliverableProgress, formatDateRange, unslottedContent,
} from '../../campaigns';
import { folderColor } from '../../folderColors';
import ColorLabel from '../ColorLabel';
import ProgressBar from '../ProgressBar';
import StagePill from '../StagePill';
import ContentBoard from './ContentBoard';
import {
  shell, heading, faintText, sectionLabel, readout, rowList, segmented, segItem,
  btnGhost, toolbarSelect,
} from '../../ui';

interface Props {
  campaign: Campaign;
  /** The client's content; the page picks out the campaign's own. */
  content: ContentItem[];
  businesses: Business[];
  /** Every campaign of the client, for the board's card labels. */
  campaigns: Campaign[];
  canManage: boolean;
  canEditItem: (item: ContentItem) => boolean;
  canDeleteItem: (item: ContentItem) => boolean;
  onBack: () => void;
  onEdit: () => void;
  onSetStatus: (status: CampaignStatus) => void;
  onOpenItem: (item: ContentItem) => void;
  /** Opens the add-content form already filed under this campaign. */
  onAddContent: (defaults: { status: ContentStatus; deliverableId?: string }) => void;
  onEditItem: (item: ContentItem) => void;
  onMoveItem: (item: ContentItem, status: ContentStatus) => void;
}

// A content item as a chip: stage first, because "which stage is each of the
// three reels at" is the question this page is opened to answer.
function ItemChip({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 h-7 max-w-[260px] pl-0.5 pr-2 rounded-tile border border-hairline dark:border-hairline-dark bg-canvas dark:bg-canvas-dark hover:bg-hover dark:hover:bg-hover-dark text-[12px] text-ink dark:text-ink-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <StagePill status={item.status} />
      <span className="truncate">{item.title}</span>
    </button>
  );
}

function DeliverableRow({
  slot, color, canAdd, onOpenItem, onAdd,
}: {
  slot: DeliverableProgress;
  color: string;
  canAdd: boolean;
  onOpenItem: (item: ContentItem) => void;
  onAdd: () => void;
}) {
  const { deliverable, items, posted, planned } = slot;
  const toMake = Math.max(0, deliverable.target - items.length);
  return (
    <div className="px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-ink dark:text-ink-dark">
          {deliverable.label}
          {deliverable.mediaType && (
            <span className={`ml-1.5 text-[11px] font-normal ${faintText}`}>
              {deliverable.mediaType === 'video' ? 'Video' : 'Graphic'}
            </span>
          )}
        </span>
        <span className={`text-[12px] tabular-nums ${faintText}`}>
          {`${posted}/${planned} posted`}
        </span>
      </div>
      <ProgressBar
        value={posted / planned}
        color={color}
        label={`${deliverable.label}: ${posted} of ${planned} posted`}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((i) => (
          <ItemChip key={i.id} item={i} onOpen={() => onOpenItem(i)} />
        ))}
        {canAdd && toMake > 0 && (
          <>
            <button
              onClick={onAdd}
              aria-label={`Add to ${deliverable.label}`}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-tile border border-dashed border-hairline dark:border-hairline-dark text-[12px] text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
              <Plus size={12} />
              Add
            </button>
            <span className={`text-[11px] ${faintText}`}>{toMake} still to make</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function CampaignPage({
  campaign, content, businesses, campaigns, canManage, canEditItem, canDeleteItem,
  onBack, onEdit, onSetStatus, onOpenItem, onAddContent, onEditItem, onMoveItem,
}: Props) {
  // Plan first: the checklist is what this page adds. The board is the same
  // kanban as the Content tab, narrowed to this campaign, at full height.
  const [view, setView] = useState<'plan' | 'board'>('plan');

  const own = content.filter((i) => i.campaignId === campaign.id);
  const progress = campaignProgress(campaign, content);
  const slots = deliverableProgress(campaign, content);
  const loose = unslottedContent(campaign, content);
  const status = campaignStatusMeta(campaign.status);
  const summary = `${progress.posted} of ${progress.planned} posted`;
  const business =
    businesses.length >= 2 ? businesses.find((b) => b.id === campaign.businessId) : undefined;
  const subtitle =
    [formatDateRange(campaign.startDate, campaign.endDate), business?.name].filter(Boolean).join(' · ') ||
    'No dates set';

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0 border-b border-hairline dark:border-hairline-dark px-4 pt-3 pb-2.5 flex flex-col gap-2.5">
        <button
          onClick={onBack}
          className={`self-start inline-flex items-center gap-1 text-[12px] font-medium ${faintText} hover:text-ink dark:hover:text-ink-dark transition-colors`}
        >
          <ArrowLeft size={13} />
          Campaigns
        </button>

        <div className="flex items-start gap-3 flex-wrap">
          <span
            className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
            style={{ backgroundColor: folderColor(campaign.color).swatch }}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <h1 className={`${heading} text-lg leading-snug`}>{campaign.name}</h1>
            <p className={`text-[12px] mt-0.5 ${faintText}`}>{subtitle}</p>
          </div>
          {canManage ? (
            <select
              aria-label="Status"
              value={campaign.status}
              onChange={(e) => onSetStatus(e.target.value as CampaignStatus)}
              className={toolbarSelect}
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          ) : (
            <ColorLabel color={status.color}>{status.label}</ColorLabel>
          )}
          {canManage && (
            <button onClick={onEdit} className={`${btnGhost} h-9 min-h-0 px-3 text-[12px]`}>
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 max-w-md">
          <ProgressBar value={progress.ratio} color={campaign.color} label={summary} />
          <span className={`text-[12px] tabular-nums whitespace-nowrap ${faintText}`}>{summary}</span>
        </div>

        <div className={`${segmented} self-start`}>
          <button onClick={() => setView('plan')} aria-pressed={view === 'plan'} className={segItem(view === 'plan')}>
            <ListChecks size={13} />
            Plan
          </button>
          <button onClick={() => setView('board')} aria-pressed={view === 'board'} className={segItem(view === 'board')}>
            <LayoutGrid size={13} />
            Board
            <span className="tabular-nums opacity-70">{own.length}</span>
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <ContentBoard
          content={own}
          campaigns={campaigns}
          isClientRole={false}
          canAdd={canManage}
          canEditItem={canEditItem}
          canDeleteItem={canDeleteItem}
          onOpen={onOpenItem}
          onAdd={(s) => onAddContent({ status: s })}
          onEdit={onEditItem}
          onMove={onMoveItem}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={`${shell} py-6 max-w-[820px] flex flex-col gap-6`}>
            <section aria-label="Brief">
              <h2 className={`${sectionLabel} mb-1.5`}>Brief</h2>
              {campaign.brief ? (
                <p className={readout}>{campaign.brief}</p>
              ) : (
                <p className={`text-[13px] ${faintText}`}>
                  No brief yet.{canManage ? ' Add one with Edit.' : ''}
                </p>
              )}
            </section>

            <section aria-label="Deliverables">
              <h2 className={`${sectionLabel} mb-1.5`}>Deliverables</h2>
              {slots.length === 0 ? (
                <p className={`text-[13px] ${faintText}`}>
                  Nothing planned yet.
                  {canManage
                    ? ' List what this campaign needs — 3 Reels, 2 carousels — with Edit, and progress fills in as content is linked.'
                    : ''}
                </p>
              ) : (
                <div className={rowList}>
                  {slots.map((s) => (
                    <DeliverableRow
                      key={s.deliverable.id}
                      slot={s}
                      color={campaign.color}
                      canAdd={canManage}
                      onOpenItem={onOpenItem}
                      onAdd={() => onAddContent({ status: 'editing', deliverableId: s.deliverable.id })}
                    />
                  ))}
                </div>
              )}
            </section>

            {loose.length > 0 && (
              <section aria-label="Also in this campaign">
                <h2 className={`${sectionLabel} mb-1.5`}>Also in this campaign</h2>
                <div className="flex flex-wrap gap-1.5">
                  {loose.map((i) => (
                    <ItemChip key={i.id} item={i} onOpen={() => onOpenItem(i)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/workspace/CampaignPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/CampaignPage.tsx src/components/workspace/CampaignPage.test.tsx
git commit -m "Add the campaign page: brief, deliverables checklist and campaign board

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 23: Ideas follow the business scope

**Files:**
- Modify: `src/components/IdeasView.tsx`
- Test: `src/components/IdeasView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/IdeasView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Business, Idea } from '../types';

// IdeasView reads ideas through the store, which talks to Firestore; the test
// swaps in a plain object it can fill and inspect.
const ideasApi = vi.hoisted(() => ({
  ideas: [] as Idea[],
  loading: false,
  addIdea: vi.fn(async () => {}),
  setIdeaStatus: vi.fn(),
  deleteIdea: vi.fn(),
  addIdeaComment: vi.fn(),
}));

vi.mock('../store', () => ({
  useIdeas: () => ideasApi,
  useComments: () => ({ comments: [], loading: false }),
}));

import IdeasView from './IdeasView';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

function idea(id: string, title: string, businessId?: string): Idea {
  return {
    id, title, description: '', links: [], status: 'new',
    createdByEmail: 'a@b.c', createdByName: 'A', createdAt: 1,
    ...(businessId ? { businessId } : {}),
  };
}

describe('IdeasView — business scope', () => {
  beforeEach(() => ideasApi.addIdea.mockClear());

  it("shows only the scoped business's ideas, counting older ones as the first business", () => {
    ideasApi.ideas = [idea('a', 'Old idea'), idea('b', 'Cafe idea', 'b2')];
    render(<IdeasView clientId="acme" businesses={[BAKERY, CAFE]} businessId="b1" canTriage onConvert={vi.fn()} />);
    expect(screen.getByText('Old idea')).toBeInTheDocument();
    expect(screen.queryByText('Cafe idea')).not.toBeInTheDocument();
  });

  it('shows every idea with no scope', () => {
    ideasApi.ideas = [idea('a', 'Old idea'), idea('b', 'Cafe idea', 'b2')];
    render(<IdeasView clientId="acme" businesses={[BAKERY, CAFE]} canTriage onConvert={vi.fn()} />);
    expect(screen.getByText('Cafe idea')).toBeInTheDocument();
  });

  it('files a new idea under the scoped business', async () => {
    ideasApi.ideas = [];
    render(<IdeasView clientId="acme" businesses={[BAKERY, CAFE]} businessId="b2" canTriage onConvert={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /New Idea/ }));
    await userEvent.type(screen.getByPlaceholderText('Behind the scenes of the new store'), 'Pop-up stall');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Idea' }));
    expect(ideasApi.addIdea).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pop-up stall', businessId: 'b2' })
    );
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/IdeasView.test.tsx`
Expected: FAIL — "Cafe idea" is shown in the scoped test, and `addIdea` is called without `businessId`.

- [ ] **Step 3: Implement**

In `src/components/IdeasView.tsx`:

Change the `../types` import to `import { Business, Idea, IdeaStatus } from '../types';` and add `import { businessIdOf } from '../campaigns';`.

Replace the `IdeasView` signature and its first line with:

```tsx
export default function IdeasView({
  clientId,
  businesses,
  businessId,
  canTriage,
  onConvert,
}: {
  clientId: string;
  /** The client's businesses, for placing ideas submitted before businesses existed. */
  businesses: Business[];
  /** Shows only this business's ideas, and files new ones under it. */
  businessId?: string;
  /** Admins and managers triage; clients submit and discuss. */
  canTriage: boolean;
  onConvert: (idea: Idea) => void;
}) {
  const {
    ideas: allIdeas, loading, addIdea, setIdeaStatus, deleteIdea, addIdeaComment,
  } = useIdeas(clientId);
  const ideas = businessId
    ? allIdeas.filter((i) => businessIdOf(i, businesses) === businessId)
    : allIdeas;
```

Replace the form line at the bottom with:

```tsx
      {showForm && (
        <IdeaForm
          onClose={() => setShowForm(false)}
          onSubmit={(data) => addIdea({ ...data, ...(businessId ? { businessId } : {}) })}
        />
      )}
```

`ClientBoardPage` still renders `<IdeasView … />` without `businesses` until Task 24 deletes it. To keep this task compiling, add `businesses={client.businesses}` to that call in `src/pages/ClientBoardPage.tsx`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/IdeasView.test.tsx` → PASS (3 tests).
Run: `npx tsc --noEmit` → no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/IdeasView.tsx src/components/IdeasView.test.tsx src/pages/ClientBoardPage.tsx
git commit -m "Scope ideas to the selected business and file new ones under it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 24: The workspace page, the routes, and retiring `ClientBoardPage`

**Files:**
- Create: `src/pages/ClientWorkspacePage.tsx`
- Modify: `src/App.tsx`
- Delete: `src/pages/ClientBoardPage.tsx`

Its parts are unit-tested in Tasks 2–23; this task is wiring, verified by the type-check, the suite, a production build, and in the browser in Task 25.

- [ ] **Step 1: Create the page**

Create `src/pages/ClientWorkspacePage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  markIdeaConverted, useCampaigns, useClients, useShareActions, useShareReconciler,
} from '../store';
import {
  Business, BusinessDraft, Campaign, CampaignDraft, Client, ClientReview, ContentItem,
  ContentStatus, Idea,
} from '../types';
import { businessDeleteBlocker, scopeContent } from '../campaigns';
import { campaignPath, parseTab, resolveScope, tabsFor, workspacePath } from '../workspace';
import { runWrite } from '../utils';
import WorkspaceTabs from '../components/workspace/WorkspaceTabs';
import WorkspaceMenu from '../components/workspace/WorkspaceMenu';
import BusinessScopeBar from '../components/workspace/BusinessScopeBar';
import OverviewTab from '../components/workspace/OverviewTab';
import ContentBoard from '../components/workspace/ContentBoard';
import CampaignsTab from '../components/workspace/CampaignsTab';
import CampaignPage from '../components/workspace/CampaignPage';
import ContentCalendar from '../components/ContentCalendar';
import IdeasView from '../components/IdeasView';
import AddContentModal, { ContentFormData } from '../components/AddContentModal';
import ContentDetailModal from '../components/ContentDetailModal';
import BusinessModal from '../components/BusinessModal';
import CampaignModal from '../components/CampaignModal';
import ClientModal from '../components/ClientModal';
import { faintText, shell } from '../ui';

type Store = ReturnType<typeof useClients>;

// Everything that can open the add-content form, in one shape: a column's "+",
// a calendar day, an accepted idea, a campaign deliverable.
interface AddRequest {
  status: ContentStatus;
  scheduledAt?: number;
  title?: string;
  caption?: string;
  link?: string;
  businessId?: string;
  campaignId?: string;
  deliverableId?: string;
  /** Set when converting an idea, so the idea is marked done afterwards. */
  ideaId?: string;
}

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
    </div>
  );
}

// Loads the client and settles access, then hands a definite Client to the
// workspace — so nothing below has to cope with it being undefined, and the
// workspace's own hooks are never behind an early return.
export default function ClientWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const store = useClients();
  const client = store.clients.find((c) => c.id === id);

  if (store.loading) return <Spinner />;

  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className={`mb-4 text-sm ${faintText}`}>Client not found.</p>
          <button onClick={() => navigate('/')} className="text-sm text-brand hover:text-brand-hover">
            ← Back to clients
          </button>
        </div>
      </div>
    );
  }

  if (currentUser?.role === 'client' && !currentUser.assignedClientIds?.includes(client.id)) {
    return <Navigate to="/" replace />;
  }

  // Keyed by client, so switching clients (the sidebar, or ⌘K with a form
  // open) starts a fresh workspace: no form, filter or campaign list carries
  // over and saves into the wrong client.
  return <Workspace key={client.id} client={client} store={store} />;
}

function Workspace({ client, store }: { client: Client; store: Store }) {
  const { tab: tabParam, campaignId } = useParams<{ tab?: string; campaignId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();

  const role = currentUser?.role;
  const isAdmin = role === 'admin';
  const isSMM = role === 'social-media-manager';
  const isClientRole = role === 'client';
  const canManage = isAdmin || isSMM;

  const {
    campaigns, loading: campaignsLoading, addCampaign, updateCampaign, setCampaignStatus,
    deleteCampaign,
  } = useCampaigns(client.id);
  const { createShare } = useShareActions(client.id, client.name);
  useShareReconciler(client.id, !isClientRole);

  const [adding, setAdding] = useState<AddRequest | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [businessForm, setBusinessForm] = useState<{ business?: Business } | null>(null);
  const [campaignForm, setCampaignForm] = useState<{ campaign?: Campaign } | null>(null);
  const [editingClient, setEditingClient] = useState(false);

  // ?item=<id> opens that item's sheet on whichever tab is showing. This is
  // what lets Today and the command palette link to one piece of content.
  const deepLinkedId = searchParams.get('item');
  useEffect(() => {
    if (deepLinkedId) setSelectedId(deepLinkedId);
  }, [deepLinkedId]);

  const tabs = tabsFor(role);
  const tab = parseTab(tabParam, tabs);
  const businesses = client.businesses;
  // Adding a business or a campaign waits for the client's first business —
  // until the migration gives it one, a new business would become "first" and
  // swallow the client's existing content.
  const hasBusinesses = businesses.length > 0;
  const businessId = resolveScope(searchParams.get('b'), businesses);
  const content = scopeContent(client.content, { businessId }, businesses, campaigns);
  const scopedCampaigns = businessId
    ? campaigns.filter((c) => c.businessId === businessId)
    : campaigns;
  // A client never sees work still in Editing. The board hides that column, so
  // the calendar has to agree with it.
  const visibleContent = isClientRole ? content.filter((i) => i.status !== 'editing') : content;
  // Read from the live list rather than a snapshot held in state, so the sheet
  // reflects a stage change or a review decision as it happens.
  const selectedItem = selectedId ? client.content.find((c) => c.id === selectedId) ?? null : null;
  const formBusiness = businessForm?.business;
  const formCampaign = campaignForm?.campaign;

  function closeDetail() {
    setSelectedId(null);
    if (searchParams.has('item')) {
      const next = new URLSearchParams(searchParams);
      next.delete('item');
      setSearchParams(next, { replace: true });
    }
  }

  // Replace, not push: stepping Back through every scope change would be a
  // history of filter clicks rather than of places.
  function setScope(next: string | undefined) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('b', next);
    else params.delete('b');
    setSearchParams(params, { replace: true });
  }

  function canChangeItem(item: ContentItem): boolean {
    if (isAdmin) return true;
    if (isSMM) return item.uploadedByEmail === currentUser?.email;
    return false;
  }

  function moveItem(item: ContentItem, status: ContentStatus) {
    runWrite(() => store.updateContentStatus(client.id, item.id, status), 'move the content');
  }

  // New content lands in whatever is being looked at: the scoped business, and
  // the campaign and deliverable when it is added from one.
  function startAdd(request: AddRequest) {
    setAdding({ businessId, ...request });
  }

  function submitAdd(request: AddRequest, data: ContentFormData) {
    setAdding(null);
    runWrite(async () => {
      const contentId = await store.addContent(client.id, {
        ...data,
        uploadedByEmail: currentUser?.email ?? '',
      });
      if (request.ideaId) await markIdeaConverted(client.id, request.ideaId, contentId);
    }, request.ideaId ? 'create the content' : 'add the content');
  }

  function submitEdit(item: ContentItem, data: ContentFormData) {
    setEditingItem(null);
    runWrite(
      () =>
        store.updateContent(client.id, item.id, {
          title: data.title,
          driveLink: data.driveLink,
          driveFileId: data.driveFileId,
          mediaType: data.mediaType,
          caption: data.caption,
          hashtags: data.hashtags,
          platforms: data.platforms,
          notes: data.notes,
          scheduledAt: data.scheduledAt,
          businessId: data.businessId,
          campaignId: data.campaignId,
          deliverableId: data.deliverableId,
        }),
      'save the content'
    );
  }

  // Both saves hand their result back to the form, which stays open with what
  // was typed when the write fails.
  function saveBusiness(draft: BusinessDraft) {
    return runWrite(
      () =>
        formBusiness
          ? store.updateBusiness(client.id, formBusiness.id, draft)
          : store.addBusiness(client.id, draft),
      formBusiness ? 'save the business' : 'add the business'
    );
  }

  function removeBusiness(business: Business) {
    if (businessId === business.id) setScope(undefined);
    runWrite(() => store.deleteBusiness(client.id, business.id), 'delete the business');
  }

  function saveCampaign(draft: CampaignDraft) {
    return runWrite(async () => {
      if (formCampaign) {
        await updateCampaign(formCampaign.id, draft);
        return;
      }
      const newId = await addCampaign(draft);
      if (newId) navigate(campaignPath(client.id, newId, businessId));
    }, formCampaign ? 'save the campaign' : 'create the campaign');
  }

  // Leave first, then delete: deleting first would flash "this campaign no
  // longer exists" on the page being left.
  function removeCampaign(campaign: Campaign) {
    navigate(workspacePath(client.id, 'campaigns', businessId), { replace: true });
    runWrite(() => deleteCampaign(campaign.id), 'delete the campaign');
  }

  function renderBody() {
    if (campaignId) {
      if (isClientRole) return <Navigate to={workspacePath(client.id, 'content')} replace />;
      const campaign = campaigns.find((c) => c.id === campaignId);
      if (!campaign) {
        if (campaignsLoading) return <Spinner />;
        return (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <p className={`mb-3 text-sm ${faintText}`}>This campaign no longer exists.</p>
              <button
                onClick={() => navigate(workspacePath(client.id, 'campaigns', businessId))}
                className="text-sm text-brand hover:text-brand-hover"
              >
                ← All campaigns
              </button>
            </div>
          </div>
        );
      }
      return (
        <CampaignPage
          campaign={campaign}
          content={client.content}
          businesses={businesses}
          campaigns={campaigns}
          canManage={canManage}
          canEditItem={canChangeItem}
          canDeleteItem={canChangeItem}
          onBack={() => navigate(workspacePath(client.id, 'campaigns', businessId))}
          onEdit={() => setCampaignForm({ campaign })}
          onSetStatus={(status) =>
            runWrite(() => setCampaignStatus(campaign.id, status), 'change the campaign status')
          }
          onOpenItem={(item) => setSelectedId(item.id)}
          onAddContent={({ status, deliverableId }) =>
            startAdd({ status, businessId: campaign.businessId, campaignId: campaign.id, deliverableId })
          }
          onEditItem={setEditingItem}
          onMoveItem={moveItem}
        />
      );
    }

    switch (tab) {
      case 'overview':
        return (
          <OverviewTab
            client={client}
            content={content}
            campaigns={scopedCampaigns}
            allCampaigns={campaigns}
            businessId={businessId}
            canManage={canManage}
            onSelectBusiness={setScope}
            onEditBusiness={(business) => setBusinessForm({ business })}
            onAddBusiness={() => setBusinessForm({})}
            onOpenItem={(item) => setSelectedId(item.id)}
            onOpenCampaign={(c) => navigate(campaignPath(client.id, c.id, businessId))}
          />
        );
      case 'campaigns':
        return (
          <CampaignsTab
            campaigns={scopedCampaigns}
            content={client.content}
            businesses={businesses}
            canManage={canManage && hasBusinesses}
            onOpen={(c) => navigate(campaignPath(client.id, c.id, businessId))}
            onNew={() => setCampaignForm({})}
          />
        );
      case 'calendar':
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className={`${shell} py-5`}>
              <ContentCalendar
                content={visibleContent}
                canAdd={canManage}
                onDayClick={(date) => {
                  if (canManage) startAdd({ status: 'to-post', scheduledAt: date.getTime() });
                }}
                onItemClick={(item) => setSelectedId(item.id)}
              />
            </div>
          </div>
        );
      case 'ideas':
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className={`${shell} py-5`}>
              <IdeasView
                clientId={client.id}
                businesses={businesses}
                businessId={businessId}
                canTriage={!isClientRole}
                // An accepted idea becomes content carrying its title,
                // description and first link, so nothing is retyped.
                onConvert={(idea: Idea) =>
                  startAdd({
                    status: 'editing',
                    title: idea.title,
                    caption: idea.description,
                    link: idea.links[0] ?? '',
                    ideaId: idea.id,
                    ...(idea.businessId ? { businessId: idea.businessId } : {}),
                  })
                }
              />
            </div>
          </div>
        );
      default:
        return (
          <ContentBoard
            content={content}
            campaigns={campaigns}
            isClientRole={isClientRole}
            canAdd={canManage}
            canEditItem={canChangeItem}
            canDeleteItem={canChangeItem}
            campaignFilter
            onOpen={(item) => setSelectedId(item.id)}
            onAdd={(status) => startAdd({ status })}
            onEdit={setEditingItem}
            onMove={moveItem}
          />
        );
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <WorkspaceTabs
        tabs={tabs}
        active={campaignId ? 'campaigns' : tab}
        onSelect={(t) => navigate(workspacePath(client.id, t, businessId))}
        actions={
          canManage ? (
            <WorkspaceMenu
              onEditClient={() => setEditingClient(true)}
              onAddBusiness={hasBusinesses ? () => setBusinessForm({}) : undefined}
              onNewCampaign={hasBusinesses ? () => setCampaignForm({}) : undefined}
            />
          ) : undefined
        }
      />
      <BusinessScopeBar businesses={businesses} value={businessId} onChange={setScope} />

      {renderBody()}

      {adding && (
        <AddContentModal
          defaultStatus={adding.status}
          defaultScheduledAt={adding.scheduledAt}
          defaultTitle={adding.title}
          defaultCaption={adding.caption}
          defaultLink={adding.link}
          defaultBusinessId={adding.businessId}
          defaultCampaignId={adding.campaignId}
          defaultDeliverableId={adding.deliverableId}
          businesses={businesses}
          campaigns={campaigns}
          onClose={() => setAdding(null)}
          onSubmit={(data) => submitAdd(adding, data)}
        />
      )}

      {editingItem && (
        <AddContentModal
          defaultStatus={editingItem.status}
          existingItem={editingItem}
          businesses={businesses}
          campaigns={campaigns}
          onClose={() => setEditingItem(null)}
          onSubmit={(data) => submitEdit(editingItem, data)}
        />
      )}

      {selectedItem && (
        <ContentDetailModal
          clientId={client.id}
          item={selectedItem}
          isClientRole={isClientRole}
          canEdit={canChangeItem(selectedItem)}
          canDelete={canChangeItem(selectedItem)}
          onComment={(body, atSeconds) =>
            store.addComment(client.id, selectedItem.id, body, atSeconds)
          }
          onShare={isClientRole ? undefined : () => createShare(selectedItem)}
          onChangeStatus={isClientRole ? undefined : (status) => moveItem(selectedItem, status)}
          onClose={closeDetail}
          onEdit={() => {
            setEditingItem(selectedItem);
            closeDetail();
          }}
          onDelete={() => {
            runWrite(() => store.deleteContent(client.id, selectedItem.id), 'delete the content');
            closeDetail();
          }}
          // Approve/decline is offered only while the item sits in Review, so
          // "it's in Review" always means "it's waiting on the client".
          onReview={
            isClientRole && selectedItem.status === 'review'
              ? (review: ClientReview, note?: string) =>
                  runWrite(
                    () => store.updateClientReview(client.id, selectedItem.id, review, note),
                    'record your review'
                  )
              : undefined
          }
        />
      )}

      {businessForm && (
        <BusinessModal
          business={formBusiness}
          deleteBlocker={
            formBusiness
              ? businessDeleteBlocker(formBusiness.id, businesses, client.content, campaigns)
              : null
          }
          onClose={() => setBusinessForm(null)}
          onSave={saveBusiness}
          onDelete={formBusiness ? () => removeBusiness(formBusiness) : undefined}
        />
      )}

      {campaignForm && (
        <CampaignModal
          campaign={formCampaign}
          businesses={businesses}
          defaultBusinessId={businessId}
          onClose={() => setCampaignForm(null)}
          onSave={saveCampaign}
          onDelete={formCampaign ? () => removeCampaign(formCampaign) : undefined}
        />
      )}

      {editingClient && (
        <ClientModal
          client={client}
          onClose={() => setEditingClient(false)}
          onSave={(data) => runWrite(() => store.updateClient(client.id, data), 'save the client')}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Routes**

In `src/App.tsx`, replace `import ClientBoardPage from './pages/ClientBoardPage';` with `import ClientWorkspacePage from './pages/ClientWorkspacePage';`, and replace the line

```tsx
      <Route path="/client/:id" element={<AppShell><ClientBoardPage /></AppShell>} />
```

with

```tsx
      {/* :tab is optional, so the bare /client/:id every older link uses still
          opens the default tab. */}
      <Route path="/client/:id/campaign/:campaignId" element={<AppShell><ClientWorkspacePage /></AppShell>} />
      <Route path="/client/:id/:tab?" element={<AppShell><ClientWorkspacePage /></AppShell>} />
```

- [ ] **Step 3: Retire the old page**

Run: `git rm src/pages/ClientBoardPage.tsx`

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → no output.
Run: `npx vitest run` → all passed.
Run: `npm run build` → completes with `✓ built in …`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ClientWorkspacePage.tsx src/App.tsx
git commit -m "Open each client as a workspace with Overview, Content, Campaigns, Calendar and Ideas tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 25: Deploy the rules, run the migration, verify in the browser

Every step that touches production needs the user's go-ahead in chat **at that moment**. There is no Firestore emulator in this project: the dev server reads and writes the live database.

- [ ] **Step 1: Final automated checks**

Run: `npx vitest run` → all passed (record the count).
Run: `npx tsc --noEmit` → no output.
Run: `npm run build` → succeeds.

- [ ] **Step 2: Deploy the security rules — ask first**

Ask the user: "Ready to deploy the updated Firestore rules (adds businesses and campaigns; nothing existing is loosened)?" Only on a clear yes:

Run: `npx firebase deploy --only firestore:rules`
Expected: `Deploy complete!`. If the CLI is not logged in, give the user the command to run themselves (it needs their Google login) and wait.

- [ ] **Step 3: Open the app**

Start the preview with `preview_start` and the `limi-dev` configuration. The app needs a signed-in account, and the agent must not type the user's password: ask the user to sign in inside the preview pane.

- [ ] **Step 4: Run the business migration — ask first**

On the Clients page, an admin sees "Set up businesses". Ask the user before pressing it; it writes to every client. After it runs, reload: the banner is gone.

- [ ] **Step 5: Walk the workspace**

With `read_page` and screenshots, confirm:
- `/client/<id>` opens on **Content**, with the tab bar above and no business chips (one business).
- **Overview** shows the pipeline counts and the attention queue; **Campaigns** shows the empty state with "New campaign".
- Old links still work: Today → an item opens the client with that item's sheet open.
- Console (`read_console_messages`, errors only) shows no `permission-denied`.

Creating a test campaign or a second business writes real data: ask the user whether to do it, or let them click through themselves.

- [ ] **Step 6: Phone width**

`resize_window` to `mobile`: the tab bar scrolls sideways, the board shows stage tabs, nothing scrolls the page horizontally. Reset with preset `desktop`.

- [ ] **Step 7: Hand off**

Report what was verified and what was not, with a screenshot. Offer to open a PR (`superpowers:finishing-a-development-branch`).


