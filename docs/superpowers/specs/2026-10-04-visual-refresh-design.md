# Visual refresh: pastel stage cards, client folders, motion

Date: 2026-10-04
Status: approved in brainstorming

## Context

Sub-project 2 of four (see `2026-10-03-businesses-campaigns-workspace-design.md`).
The user asked for the board to look like their Weihu kanban reference — a white
page with cards coloured pastel by status — and for every client to carry a
macOS-style folder icon in a colour they choose, "like creating a folder in
OneDrive". Sub-project 1 added the colour as data (`client.color`,
`business.color`); this sub-project renders it. They also asked for the UI to
feel more interactive.

Decisions taken with the user, from a rendered mockup:

- **Pastel cards.** Each board card is filled with its stage's pastel. Chosen
  over "tinted columns, white cards" and "pastel board, keep client cards".
- **Folder grid.** The Clients page becomes a grid of colour folders, and a
  small folder replaces the lettered square everywhere a client is named.

Everything else in the Notion register stays: the sidebar shell, Inter, warm
ink, red reserved for the one primary action.

## 1. Stage card palette

The pill tints in `STAGES` are too faint to fill a whole card, so each stage
gains a card pair per theme. Values were computed, not eyeballed (WCAG 2.1):

| Stage | Light tint | Light text | Dark tint | Dark text |
| --- | --- | --- | --- | --- |
| Editing | `#ece5fa` | `#5b3596` | `#2d2448` | `#c2a6f5` |
| Review | `#dcedf9` | `#0a5f86` | `#16344a` | `#8cc8e6` |
| To Post | `#faefcc` | `#7a5600` | `#3a2c10` | `#e8b96c` |
| Posted | `#dcf0e1` | `#2a6142` | `#1a3527` | `#86c4a2` |

- Card titles stay in ink: at least 10:1 on every light tint and 10.6:1 on
  every dark one.
- Secondary text uses `ink-soft`, at least 5.4:1 on all eight tints.
- The stage text colour is at least 5.7:1 in light and 6.5:1 in dark.
- `ink-faint` measures 4.1 to 4.3:1 on the light tints, so it is **never used on a card**.

The pairs are applied through CSS custom properties plus one Tailwind class
string, the same technique as `folderColorVars`/`folderTint`, so a card follows
the theme without reading `ThemeContext`. A new `src/stageColors.ts` exports
`stageCardVars(status)` and `stageCardFill`.

## 2. Board

- **Card** (`ContentCard`): stage fill, 12px corners, no border.
  - The date and platform chips become small `white/70` (dark: `black/20`)
    pills in the stage's text colour, so they read as one layer above the fill.
  - The campaign keeps its own colour label.
  - The client's decision and an overdue date sit on solid white (dark:
    `black/30`) chips, because their colours are measured against white. The
    overdue chip stays red.
  - The no-preview type marker becomes a translucent white square.
  - The hover-revealed actions use a `white/60` hover.
- **Column** (`KanbanColumn`): the grey box goes, so cards sit on the white page.
  - The header is a stage-colour dot, the label in ink, and the count chip.
  - While a card is dragged over a column, a dashed outline and a faint wash
    mark the drop target.
  - The empty-column purpose text stays.
- **Drag**: the overlay card tilts 1.5° and scales to 1.02 with the lift shadow,
  as if picked up. dnd-kit's drop animation settles it over 220ms on an ease-out
  curve.
- The phone board (stage tabs over one column) and the campaign page's board
  reuse these components and change with them.
- **Overview's pipeline tiles** take the same stage fills, so the four counts
  read as the board's four columns. The dashboard's pipeline bars take the
  board's own stage names and colours, replacing a private copy that had
  drifted to "In Review" and "Ready to Post".

## 3. Folder icon

`src/components/FolderIcon.tsx` draws a macOS-style folder in SVG.

- **Props:** `color` (a `FolderColor` id), `size` (px width), `label` (the
  initial for the front), `imageUrl` (a logo for the front) and `className`.
- **Shape:** a back panel and tab in the colour's `swatch`, and a lighter front
  panel. Each `FOLDER_COLORS` entry gains an explicit `front` hex. Folders look
  the same in both themes, as in Finder.
- **Emblem:**
  - At 40px and up, the front carries the logo or the initial (the first letter
    or digit of the name). A logo that fails to load falls back to the initial,
    and a corrected logo URL is tried again.
  - The initial uses the colour's own `emblem` shade, at least 3:1 on the front.
    The colour's `text` shade would fall to 2.7:1 on red and pink.
  - A smaller folder gives its emblem a larger share, so it stays readable at
    40px. The logo is 44% of the width and the initial 34% up to 56px. Both
    fall on a straight line to 36% and 26% at 88px and stay there, so a wider
    folder never carries a smaller logo. The emblem sits centred on the front
    panel.
  - Below 40px there is no emblem. The same shape is drawn at every size.
- **Accessibility:** always `aria-hidden`, because the name is always rendered
  beside it as text.
- **Hover:** inside an ancestor marked `group/folder` (a named Tailwind group),
  the folder lifts and the front panel dips slightly, as if opening. Being
  named means a card that lifts itself, such as a business card, does not lift
  the folder a second time.

Where it appears:

- **Clients page.** `ClientCard` is replaced by a folder tile.
  - The tile shows an 88px folder with the emblem, the name (two-line clamp) and
    one meta line. The meta line reads "2 to review" when anything awaits the
    client, otherwise "12 items".
  - For the team, an Edit button appears on hover or focus.
  - The grid is `repeat(auto-fill, minmax(132px, 1fr))`. The about text and the
    stage breakdown leave the tile: the board and the dashboard above the grid
    carry them.
- **Small folders replace `ClientAvatar`** in these places, which leaves it
  unused, so it is deleted:
  - the sidebar client rows (18px)
  - the client breadcrumb (22px)
  - Today's queue rows (16px)
  - search results
- **Businesses**:
  - Overview business cards show a 40px folder in the business colour.
  - `BusinessScopeBar` chips show a 14px folder.
- **Client form**: a live folder preview beside the colour swatches, so choosing
  a colour feels like colouring a folder.

## 4. Motion

CSS only — no animation library. The global `prefers-reduced-motion` rule in
`index.css` already zeroes every duration, and stays.

- **Tailwind keyframes:**
  - `fade-up`: opacity and a 6px rise, 220ms.
  - `scale-in`: opacity and scale from 0.97, 180ms.
  - `sheet-up`: a 24px rise, 240ms.
  - `fade-in`.
  - All share one `out-soft` curve, `cubic-bezier(.2,.8,.2,1)`.
- **Cards and folders:**
  - Lift 2px on hover, on hover-capable pointers only, so touch never sticks
    lifted.
  - Press in (scale 0.98) on click.
- **Dialogs:** `overlay` fades in. `modalPanel` and `sheetPanelWide` scale in;
  below `sm` the bottom sheets slide up instead.
- **Workspace tabs:** one 2px indicator slides between tabs over 200ms,
  positioned from the active tab's measured box. Where measuring is unavailable
  (jsdom), the active tab keeps its border.
- **Lists:** the Clients grid, Today rows and Overview widgets fade up in a
  stagger on first mount, 30ms apart and capped after twelve steps. CSS
  animations run on mount only, so re-renders never replay them.

## 5. Geometry

- `borderRadius.card` goes from 6px to 12px: cards, panels and dialogs.
- `borderRadius.tile` goes from 4px to 6px: buttons, inputs and chips. The
  small chips inside a board card keep 4px, which suits their 18px height.
- `segItem`'s inner radius stays 3px: the 6px strip less its 1px border and 2px
  padding.
- `rounded-full` stays for badges.

## 6. Leftover surfaces

About 290 raw colours survive from before the August redesign, mostly in the
retired near-black look. They are all moved onto tokens:

| File | Raw colours |
| --- | --- |
| `IdeasView` | 99 |
| `PublicReviewPage` | 83 |
| `App.tsx` (setup guide, splash) | 39 |
| `ContentCalendar` | 37 |
| `NotifPermissionBanner` | 21 |
| `Dashboard` | 11 |
| `UserManagementPage`, `ColorSwatchPicker` | 1 each |

- `ContentCalendar`'s private `STATUS_COLORS` goes: its events use the stage card
  palette, so To Post stops being red.
- `IdeasView`'s status colours become stage-style tinted labels.

A test then guards the result. It scans `src/**/*.tsx` for hex literals and
`neutral-*` utilities and fails on any found. The palettes themselves are
`.ts` files and the folder SVG reads `FOLDER_COLORS`, so nothing in a component
needs a literal colour.

## Testing

- **Contrast:** `color.test.ts` asserts every card pair, in both themes, for
  ink, `ink-soft` and the stage text.
- **`stageColors.test.ts`:** the custom properties for each status, and an
  unknown status falling back.
- **`FolderIcon.test.tsx`:**
  - `aria-hidden` is set.
  - The colour reaches the shapes.
  - The emblem appears only at size ≥ 40.
  - A failed logo falls back to the initial.
- **Clients grid:**
  - names and the meta line ("to review" first)
  - Edit for the team only
  - a tile opens the client
- **No-raw-colours guard**, as above.
- **Existing tests:** the 265 are updated where the markup moved (Sidebar,
  ClientCard and ClientAvatar users).
- **Browser:** hover, the drag tilt and settle, and dark mode, on the
  Firebase-free board harness under `.superpowers/`. Check that rAF is running
  first; see the `limi-browser-verification` memory.

## Non-goals

- New features or information-architecture changes. The client portal is
  sub-project 3.
- An animation library.
- Changing the sidebar shell, type scale or brand colour.
