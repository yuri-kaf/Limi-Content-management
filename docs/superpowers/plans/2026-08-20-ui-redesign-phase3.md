# Phase 3 — plus a board and Today rebuild

Date: 2026-08-20
Status: shipped

Phase 3 in the spec was "Today and the command palette". `Today` already
existed; the palette did not. This round shipped the palette and, on the user's
instruction, redesigned the two surfaces they use most — the board and Today —
because both had drifted into a state the spec's own rules would have failed.

## The two things the user asked for by name

**Stages as tabs on the phone, not a hand-scrolled row.** The previous board was
one `min-w-max` row of 280px columns at every width. On a 375px screen that
shows one column and a sliver: how many stages exist and how much sits in each
are both hidden, and reaching Posted is three swipes. It also violated the one
responsive rule with no exceptions — no horizontal scroll on a phone.

Below `lg` the board is now a 44px tab strip over one full-width column. Every
stage's count is visible at once and any stage is one tap away. The desktop board
keeps the fixed-width row unchanged.

The two layouts are chosen in JS (`useIsDesktop`), not CSS, because they cannot
both be mounted: each registers the same dnd-kit droppable and sortable ids and
the duplicates fight over every drop.

**The client's logo beside the back button.** `ClientAvatar` moved out of
`Sidebar` into its own component and now also renders in the header whenever a
client is active. It was mutating the DOM from an `onError` handler to swap in
the lettered fallback, which React undoes on the next render; the failure is now
state.

## Phase 3 proper — the command palette

`⌘K` / `Ctrl+K`, and a search button in the header, because a phone has no ⌘K
and search that only a keyboard can reach does not exist for half the users.

`palette.ts` holds the index and the ranking, so both are unit-tested rather
than eyeballed: subsequence matching with adjacency and word-boundary bonuses,
prefix always winning, kind-weighted so a two-letter query surfaces boards
before the content that happens to contain those letters. Client-role users get
an index containing only their own boards and content.

One thing found only by using it: keywords were being fuzzy-matched too, and
`keywords` carries the caption. A subsequence test over paragraphs matches
almost anything — "refin" returned 30 results, most of them unrelated items
whose caption contained r…e…f…i…n in order. Keywords are now matched as a
substring; the same query returns 4. A name is short enough for fuzzy to mean
something, a paragraph is not.

## What else changed, and why

| Fixed | Was |
| --- | --- |
| Cards without a preview show a 28px type marker | A 68×38 empty grey box — a quarter of the card's width — on every item whose Drive file is not public, which is most of them |
| Card actions are pointer-only, 26px | Four 20px targets permanently visible on touch, crowding the title, every one under the 44px minimum |
| Cards carry `flex-shrink-0` | A capped-height flex column squashed its children before it would scroll, clipping every card's second title line |
| Segmented view switcher, 4px radius | A `rounded-full` group with a filled-black active pill — two radii in one toolbar, and unlabelled icons on a phone |
| `btnIcon` is `rounded-tile` | `rounded-full`, the last consumer-app radius in a 4px system |
| Column header: pill, count chip, 28px add | Pill immediately followed by a bare grey number, reading as one label "Editing 16"; a 24px add button |
| Drop target is a class (`columnBodyOver`) | An inline `rgba(120,120,120,0.10)` — a raw colour in a component, with no dark variant |
| Phone column is a plain scroll region | A tinted bordered box framing the only column there is, at 22px of card width per side |
| Empty column under a filter says so | Recited the stage's purpose, which reads as "there is no work here" when there is |
| Today rows: avatar, title-dominant, client and relative timing beneath, stage pill always | A fixed 112px column of "Mortgage Superh…" repeated eleven times, the stage pill hidden below `sm`, and a bare red date |
| `slotLabel()` — "2 months late", "tomorrow", "in 3 days" | A red "Jun 24" that said something was wrong but not what or by how much |
| Today rows deep-link via `?item=` | Dropped you on the board to find the card you had just clicked |
| Group header is one line | Icon + label + count, then a hint paragraph — a header taller than two of its rows |
| Skeleton rows while loading | An empty page under the word "Loading…" |
| `prefers-reduced-motion` honoured globally | Not handled anywhere |

## Two decisions worth flagging

**The bottom bar is hidden inside a board.** A board is a drilled-into screen
with a back arrow and a back swipe; on a phone it needs the 56px more than it
needs a second way home. With the tab strip added the board still carries less
chrome than it did with the bar (136px against 148px). Reversible in one line if
the consistency matters more.

**Drag between stages is desktop-only on a phone, by consequence.** Only one
column is mounted, so there is nowhere to drag to. The detail sheet's stage
picker is the phone path, which is the better one on touch anyway — the 200ms
press-and-hold drag competed with scrolling.

## Not done

- Table view, bulk selection, density toggle (spec items 3, 5, 7) — still open.
- `IdeasView`, `PublicReviewPage`, `ClientsPage`'s dashboard tiles still carry
  hardcoded colour and are Phase 4.
- The palette indexes all content in memory, as the spec accepted.
