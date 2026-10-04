# Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Limi the look the user asked for:

- board cards filled with their stage's pastel;
- clients as macOS-style colour folders;
- light CSS motion;
- softer corners;
- every remaining screen moved onto the design tokens.

**Architecture:**

- **Stage colours** move into `STAGES` and reach cards as CSS custom properties, the same technique as `folderColorVars`. A card follows the theme through Tailwind's `dark:` variant without reading `ThemeContext`.
- **Folders:** a new `FolderIcon` (SVG plus an HTML emblem) replaces the lettered `ClientAvatar` everywhere.
- **Motion** is Tailwind keyframes and transitions only. `index.css` already zeroes every duration for reduced-motion users.

**Tech Stack:** React 18, TypeScript 5.9, Tailwind 3.4, dnd-kit 6, Vitest 1.6 with Testing Library and jsdom.

**Spec:** `docs/superpowers/specs/2026-10-04-visual-refresh-design.md`

---

## Conventions for every task

- **Run one test file:** `npx vitest run src/path/file.test.ts`.
- **Run everything:** `npm test`.
- **Types:** `npx tsc --noEmit`, which must print nothing.
- **Commit** through a message on stdin, so quotes in the message cannot break the shell:

  ```bash
  git add <files>
  git commit -q -F - <<'MSG'
  Subject line in the imperative

  Why, in a sentence or two.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  MSG
  ```
- **No live data.** `npm run dev` reads and writes the live Firestore database. Do not open it to click around. Browser checks happen on the harness page in Task 15.
- **Tailwind pitfall.** Two utilities that set the same CSS property, for example `w-full` and `w-[96px]`, resolve by Tailwind's own stylesheet order, not by their order in the class list. To override one, use `!` (`!w-[96px]`) or avoid stacking them.
- **No raw colours in a `.tsx` file**: no `#hex` literals and no `neutral-*` utilities. Colours come from `tailwind.config.js`, `src/ui.ts`, `STAGES` in `src/utils.ts`, `src/folderColors.ts` and the new `src/stageColors.ts`. Task 14 adds a test that enforces this. Test files may contain hex literals.

## File map

| File | Responsibility |
| --- | --- |
| `src/utils.ts` (modify) | `Stage` gains the card pairs; `STAGES` gets the values. |
| `src/stageColors.ts` (create) | `stageCardVars`, `stageCardFill`, `stageCardText`, `stageDot`. |
| `src/motion.ts` (create) | `staggerStyle(index)` and the `enter` class. |
| `tailwind.config.js` (modify) | Radii, shadows, easing, keyframes, animations. |
| `src/ui.ts` (modify) | The `lift` recipe, `cardInteractive`, dialog entrances, column recipes, `workspaceTab(active, indicator)`. |
| `src/folderColors.ts` (modify) | `front` and `emblem` per colour; `swatchTick`. |
| `src/components/FolderIcon.tsx` (create) | The folder. |
| `src/components/ClientFolder.tsx` (create) | A client on the Clients page. |
| `src/components/ClientCard.tsx` (delete) | Replaced by `ClientFolder`. |
| `src/components/ClientAvatar.tsx` (delete) | Replaced by `FolderIcon`. |
| `src/components/ContentCard.tsx`, `KanbanColumn.tsx`, `workspace/ContentBoard.tsx` | Pastel cards, lane columns, drag tilt and settle. |
| `src/components/Sidebar.tsx`, `AppShell.tsx`, `QueueGroup.tsx`, `CommandPalette.tsx`, `workspace/BusinessCard.tsx`, `workspace/BusinessScopeBar.tsx` | Folders. |
| `src/components/ClientModal.tsx`, `ColorSwatchPicker.tsx` | Folder preview, and the tick colour from `swatchTick`. |
| `src/components/workspace/WorkspaceTabs.tsx` | Sliding indicator. |
| `src/components/workspace/OverviewTab.tsx` | Pastel pipeline tiles, entrance stagger. |
| `src/components/IdeasView.tsx`, `ContentCalendar.tsx`, `pages/PublicReviewPage.tsx`, `App.tsx`, `NotifPermissionBanner.tsx`, `Dashboard.tsx` | Moved onto tokens. |
| `src/noRawColours.test.ts` (create) | The guard. |

---

### Task 1: Stage card palette

**Files:**
- Modify: `src/utils.ts` (the `Stage` interface and `STAGES`, about lines 263-294)
- Create: `src/stageColors.ts`
- Create: `src/stageColors.test.ts`
- Modify: `src/color.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing tests**

Create `src/stageColors.test.ts`:

```ts
import { stageCardFill, stageCardText, stageCardVars, stageDot } from './stageColors';
import { STAGES } from './utils';

describe('stageCardVars', () => {
  it('carries both theme pairs for a stage', () => {
    const vars = stageCardVars('review') as Record<string, string>;
    expect(vars['--sc-tint']).toBe('#dcedf9');
    expect(vars['--sc-text']).toBe('#0a5f86');
    expect(vars['--sc-tint-dark']).toBe('#16344a');
    expect(vars['--sc-text-dark']).toBe('#8cc8e6');
  });

  it('falls back to the first stage for an unknown status', () => {
    expect(stageCardVars('archived')).toEqual(stageCardVars(STAGES[0].id));
  });

  it('sets every custom property the classes read', () => {
    // Renaming one side without the other would silently un-colour every card.
    const read = [stageCardFill, stageCardText, stageDot].flatMap((cls) =>
      [...cls.matchAll(/var\((--sc-[a-z-]+)\)/g)].map((m) => m[1])
    );
    const set = Object.keys(stageCardVars('posted'));
    expect(read.length).toBeGreaterThan(0);
    for (const name of read) expect(set).toContain(name);
  });
});
```

Append to `src/color.test.ts` (after the `stage pills meet WCAG AA` block):

```ts
describe('stage cards meet WCAG AA', () => {
  // A card's title is ink, its secondary text ink-soft, its chips the stage
  // text. ink-faint is never used on a card: it measures 4.1 to 4.3:1 on the
  // light tints.
  it.each(STAGES)('$label card is readable in light mode', (stage) => {
    expect(contrastRatio(palette.ink.DEFAULT, stage.cardTint)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(palette.ink.soft, stage.cardTint)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(stage.cardText, stage.cardTint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(STAGES)('$label card is readable in dark mode', (stage) => {
    expect(contrastRatio(palette.ink.dark, stage.cardTintDark)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(palette.ink.softdark, stage.cardTintDark)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(stage.cardTextDark, stage.cardTintDark)).toBeGreaterThanOrEqual(AA);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/stageColors.test.ts src/color.test.ts`
Expected: FAIL. `stageColors.test.ts` cannot resolve `./stageColors`, and the new color tests fail because `stage.cardTint` is `undefined`.

- [ ] **Step 3: Add the card pairs to `STAGES`**

In `src/utils.ts`, replace the `Stage` interface and the `STAGES` array with:

```ts
export interface Stage {
  id: ContentStatus;
  label: string;
  /** Solid hue. Still used for the board's accent line and the calendar dots. */
  color: string;
  /** Pill background / text, light theme. */
  tint: string;
  text: string;
  /** Pill background / text, dark theme. */
  tintDark: string;
  textDark: string;
  /**
   * A whole board card's fill, and the stage-coloured text on it (chips,
   * metadata), light theme. Stronger than the pill tint, which is too faint to
   * fill a card. A card's title stays in ink.
   */
  cardTint: string;
  cardText: string;
  /** The same pair, dark theme. */
  cardTintDark: string;
  cardTextDark: string;
}

// The pill pairs below are asserted against WCAG AA in src/color.test.ts. Note
// that `to-post` text is #8a6100 rather than the more obvious #996c00: that
// measured 4.21 against its tint and failed.
//
// A stage is never signalled by colour alone — the label is always present, and
// the tint only reinforces it. That is what permits the 6-8 colour-vision
// separation band these hues sit in.
export const STAGES: Stage[] = [
  { id: 'editing', label: 'Editing', color: '#6940a5',
    tint: '#f4f0fb', text: '#6940a5', tintDark: '#2b2142', textDark: '#b592f0',
    cardTint: '#ece5fa', cardText: '#5b3596', cardTintDark: '#2d2448', cardTextDark: '#c2a6f5' },
  { id: 'review', label: 'Review', color: '#0b6e99',
    tint: '#e7f3f8', text: '#0b6e99', tintDark: '#15303d', textDark: '#77bddd',
    cardTint: '#dcedf9', cardText: '#0a5f86', cardTintDark: '#16344a', cardTextDark: '#8cc8e6' },
  { id: 'to-post', label: 'To Post', color: '#8a6100',
    tint: '#faf3dd', text: '#8a6100', tintDark: '#332711', textDark: '#dfab5f',
    cardTint: '#faefcc', cardText: '#7a5600', cardTintDark: '#3a2c10', cardTextDark: '#e8b96c' },
  { id: 'posted', label: 'Posted', color: '#2f6e4a',
    tint: '#eef3ed', text: '#2f6e4a', tintDark: '#1a2e23', textDark: '#71b391',
    cardTint: '#dcf0e1', cardText: '#2a6142', cardTintDark: '#1a3527', cardTextDark: '#86c4a2' },
];
```

- [ ] **Step 4: Create `src/stageColors.ts`**

```ts
import type { CSSProperties } from 'react';
import { STAGES } from './utils';

// A board card is filled with its stage's pastel. The pairs live on STAGES,
// beside the pill pairs, and color.test.ts asserts them against WCAG AA. As
// with folder colours (see folderColorVars), they travel as custom properties
// and the classes below pick the theme's pair with Tailwind's `dark:` variant,
// so a card follows the theme without reading ThemeContext.
export function stageCardVars(status: string): CSSProperties {
  const stage = STAGES.find((s) => s.id === status) ?? STAGES[0];
  return {
    '--sc-tint': stage.cardTint,
    '--sc-text': stage.cardText,
    '--sc-tint-dark': stage.cardTintDark,
    '--sc-text-dark': stage.cardTextDark,
    '--sc-dot': stage.color,
    '--sc-dot-dark': stage.textDark,
  } as CSSProperties;
}

// Each is one literal string so Tailwind's scanner sees every class.

/** The card's fill. */
export const stageCardFill = 'bg-[color:var(--sc-tint)] dark:bg-[color:var(--sc-tint-dark)]';

/** Stage-coloured text on the fill: chips and metadata, never the title. */
export const stageCardText = 'text-[color:var(--sc-text)] dark:text-[color:var(--sc-text-dark)]';

/** A small solid marker in the stage's colour, beside its name. */
export const stageDot = 'bg-[color:var(--sc-dot)] dark:bg-[color:var(--sc-dot-dark)]';
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npx vitest run src/stageColors.test.ts src/color.test.ts`
Expected: PASS. Then run `npx tsc --noEmit`; expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/utils.ts src/stageColors.ts src/stageColors.test.ts src/color.test.ts
git commit -q -F - <<'MSG'
Add contrast-tested pastel card colours for each stage

The pill tints are too faint to fill a whole card. Each stage now carries a
card pair per theme, asserted against WCAG AA for the title, the secondary
text and the stage-coloured chips, and stageColors.ts hands them to a card
as custom properties so it follows the theme without reading the context.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 2: Geometry and motion tokens

**Files:**
- Modify: `tailwind.config.js` (the `borderRadius` and `boxShadow` blocks, about lines 54-71)
- Modify: `src/ui.ts` (`cardInteractive`, `overlay`, `modalPanel`, `sheetOverlay`, `sheetPanel`, `sheetPanelWide`, `segItem`)
- Create: `src/motion.ts`
- Create: `src/motion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/motion.test.ts`:

```ts
import { enter, staggerStyle } from './motion';

describe('staggerStyle', () => {
  it('starts each item a little after the one before', () => {
    expect(staggerStyle(0).animationDelay).toBe('0ms');
    expect(staggerStyle(1).animationDelay).toBe('30ms');
    expect(staggerStyle(3).animationDelay).toBe('90ms');
  });

  it('stops growing after the twelfth item, so a long list is never kept waiting', () => {
    expect(staggerStyle(12).animationDelay).toBe('360ms');
    expect(staggerStyle(50).animationDelay).toBe('360ms');
  });

  it('treats a negative index as the first', () => {
    expect(staggerStyle(-1).animationDelay).toBe('0ms');
  });

  it('pairs with the fade-up entrance', () => {
    expect(enter).toBe('animate-fade-up');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/motion.test.ts`
Expected: FAIL. The import of `./motion` cannot be resolved.

- [ ] **Step 3: Create `src/motion.ts`**

```ts
import type { CSSProperties } from 'react';

// Lists enter in a quick stagger the first time they render: each item starts
// a little after the one above it. CSS animations run on mount only, so a
// re-render never replays them, and index.css zeroes them for anyone who has
// asked for reduced motion. Capped, so the fortieth client is not left waiting
// a second for a decorative effect.
const STEP_MS = 30;
const CAP = 12;

export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(Math.max(index, 0), CAP) * STEP_MS}ms` };
}

/** The entrance itself. Its fill mode is `backwards`, so an item stays hidden through its delay. */
export const enter = 'animate-fade-up';
```

- [ ] **Step 4: Update `tailwind.config.js`**

Replace the `borderRadius` and `boxShadow` blocks, from the `borderRadius: {` line to the closing `},` of `boxShadow`, with:

```js
      borderRadius: {
        // Softer than the Notion register's 4/6px, to sit with the pastel
        // cards: 12px for cards, panels and dialogs, 6px for controls.
        card: '12px',
        tile: '6px',
      },
      boxShadow: {
        // Static surfaces are defined by a hairline, not a shadow. `shadow-card`
        // is deliberately flattened rather than removed so existing components
        // that reference it become flat instead of losing a class silently.
        card: 'none',
        lift: '0 4px 12px rgba(15,15,15,0.10), 0 1px 3px rgba(15,15,15,0.06)',
        // A card under the pointer: just enough to read as raised off the page.
        // Not named `hover`: a colour of that name exists, and shadow-hover
        // would then also set the shadow's colour to it.
        float: '0 6px 16px -4px rgba(15,15,15,0.12), 0 2px 4px rgba(15,15,15,0.05)',
        // A card in the hand, mid-drag.
        drag: '0 18px 36px -10px rgba(15,15,15,0.25), 0 4px 10px rgba(15,15,15,0.08)',
        pill: 'none',
      },
      // One curve for everything that moves: quick to start, soft to land.
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(.2,.8,.2,1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      // `backwards` holds the first frame through any delay, which is what lets
      // a staggered list item stay hidden until its turn, and lets go once it
      // has played, so an element's own hover and press transforms are never
      // overridden by a finished entrance.
      animation: {
        'fade-in': 'fade-in 160ms cubic-bezier(.2,.8,.2,1) backwards',
        'fade-up': 'fade-up 220ms cubic-bezier(.2,.8,.2,1) backwards',
        'scale-in': 'scale-in 180ms cubic-bezier(.2,.8,.2,1) backwards',
        'sheet-up': 'sheet-up 240ms cubic-bezier(.2,.8,.2,1) backwards',
      },
```

- [ ] **Step 5: Update `src/ui.ts`**

Replace the `cardInteractive` comment and definition:

```ts
// Clickable cards get a hairline that firms up and a tint, not a lift. In this
// register nothing floats unless it is genuinely floating.
export const cardInteractive = `${card} transition-colors duration-150 hover:bg-tint dark:hover:bg-tint-dark hover:border-ink-faint/30 dark:hover:border-ink-faintdark/30 cursor-pointer`;
```

with:

```ts
// Raised on hover and pressed in on click: the one motion every clickable card
// shares. Hover applies only where the pointer can hover, so a tap on a phone
// never leaves a card stuck in the air. Reduced motion is handled globally in
// index.css.
export const lift =
  'transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out-soft [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-float active:translate-y-0 active:scale-[.98]';

// Clickable cards lift off the page, and their hairline firms up as they do.
export const cardInteractive = `${card} ${lift} hover:border-ink-faint/30 dark:hover:border-ink-faintdark/30 cursor-pointer`;
```

Give the four dialog recipes their entrances. Each keeps its existing string and gains a suffix:

```ts
export const overlay =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 dark:bg-black/70 backdrop-blur-md animate-fade-in';

export const modalPanel =
  'w-full max-w-md p-6 bg-surface dark:bg-surface-dark rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark max-h-[90dvh] overflow-y-auto animate-scale-in';
```

```ts
export const sheetOverlay =
  'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-ink/40 dark:bg-black/70 backdrop-blur-md animate-fade-in';

// A sheet rises from the bottom edge on a phone and scales in as a dialog from
// `sm` up, matching where it sits in each layout.
export const sheetPanel =
  'w-full sm:max-w-lg bg-surface dark:bg-surface-dark rounded-t-card sm:rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark overflow-hidden overflow-y-auto max-h-[92dvh] animate-sheet-up sm:animate-scale-in';
```

```ts
export const sheetPanelWide =
  'w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl bg-surface dark:bg-surface-dark rounded-t-card sm:rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark flex flex-col max-h-[92dvh] overflow-hidden animate-sheet-up sm:animate-scale-in';
```

In `src/index.css`, inside the `@media (prefers-reduced-motion: reduce)` rule, add `animation-delay: 0ms !important;` after the `animation-duration` line: zeroing the duration alone would still hold a staggered item hidden for its delay.

In `segItem`, change `rounded-[3px]` to `rounded-[4px]`, so the inner segment stays concentric with the 6px strip.

- [ ] **Step 6: Run the tests and types**

Run: `npx vitest run src/motion.test.ts` and expect PASS.
Then `npm test`, and expect every file to pass (the suite was 265 tests before this plan; the count only grows).
Then `npx tsc --noEmit`, and expect no output.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js src/ui.ts src/motion.ts src/motion.test.ts
git commit -q -F - <<'MSG'
Add softer corners and the motion vocabulary

Cards, panels and dialogs move to 12px corners and controls to 6px. One
easing curve, four entrance keyframes and a lift recipe give every
clickable card the same raise on hover and press on click, dialogs scale
in, and phone sheets rise from the bottom edge. Lists get a capped stagger.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 3: Pastel board cards, lane columns, drag tilt and settle

**Files:**
- Modify: `src/ui.ts` (`columnHeader`, `columnBody`, `columnBodyOver`)
- Modify: `src/components/ContentCard.tsx`
- Modify: `src/components/KanbanColumn.tsx`
- Modify: `src/components/workspace/ContentBoard.tsx`
- Create: `src/components/ContentCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ContentCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import ContentCard from './ContentCard';
import { ContentItem } from '../types';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 'Momo reel', driveLink: '', driveFileId: '', status: 'review',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

// useSortable needs the contexts the board provides.
function renderCard(props: Partial<React.ComponentProps<typeof ContentCard>> = {}) {
  const it = props.item ?? item();
  return render(
    <DndContext>
      <SortableContext items={[it.id]}>
        <ContentCard {...props} item={it} />
      </SortableContext>
    </DndContext>
  );
}

const cardOf = (title: string) => screen.getByText(title).closest('[data-stage]') as HTMLElement;

describe('ContentCard', () => {
  it("fills the card with its stage's pastel", () => {
    renderCard({ item: item({ status: 'to-post' }) });
    const card = cardOf('Momo reel');
    expect(card).toHaveAttribute('data-stage', 'to-post');
    expect(card.style.getPropertyValue('--sc-tint')).toBe('#faefcc');
    expect(card.style.getPropertyValue('--sc-tint-dark')).toBe('#3a2c10');
  });

  it('shows the campaign and the client decision as chips', () => {
    renderCard({
      item: item({ clientReview: 'approved' }),
      campaign: { name: 'Dashain sale', color: 'orange' },
    });
    expect(screen.getByText('Dashain sale')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('lifts on hover where it sits on the board', () => {
    renderCard();
    expect(cardOf('Momo reel').className).toContain('hover:-translate-y-0.5');
  });

  it('tilts the copy that follows the pointer during a drag', () => {
    renderCard({ isOverlay: true });
    const card = cardOf('Momo reel');
    expect(card.className).toContain('rotate-[1.5deg]');
    expect(card.className).not.toContain('hover:-translate-y-0.5');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/ContentCard.test.tsx`
Expected: FAIL. `closest('[data-stage]')` returns null, because the card has no `data-stage` yet.

- [ ] **Step 3: Rewrite `src/components/ContentCard.tsx`**

Replace the whole file with:

```tsx
import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Campaign, ContentItem } from '../types';
import { getMediaInfo, mediaTypeOf, captionOf, PLATFORM_LABELS } from '../utils';
import { stageCardFill, stageCardText, stageCardVars } from '../stageColors';
import { lift } from '../ui';
import ColorLabel from './ColorLabel';
import {
  Film, GripVertical, ExternalLink, Pencil, Trash2, Calendar, AlertCircle,
  Image as ImageIcon, Download,
} from 'lucide-react';

interface Props {
  item: ContentItem;
  /** The campaign it belongs to, shown as a coloured label. */
  campaign?: Pick<Campaign, 'name' | 'color'>;
  onCardClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * True for the copy rendered inside <DragOverlay>. That copy shares the
   * dragged item's id, so leaving it enabled would register a drop target that
   * follows the cursor and wins every collision test against the real columns.
   */
  isOverlay?: boolean;
}

// Past this many pixels a press is a drag, so the release must not also be
// treated as a click that opens the detail sheet. Deliberately below dnd-kit's
// own 8px activation distance: a press that wandered without ever starting a
// drag should still count as a click.
const CLICK_SLOP = 4;

// On the pastel fill a hover wash has to be lighter than the card, not darker.
const iconBtn =
  'w-[26px] h-[26px] inline-flex items-center justify-center rounded-tile text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark hover:bg-white/60 dark:hover:bg-black/20 transition-colors';

// Chips sit one layer above the fill: translucent white in light, a darker wash
// in dark. Their stage-coloured text clears AA on the fill itself, and the
// wash only lightens (or, in dark, deepens) what it sits on.
const chip = `bg-white/70 dark:bg-black/20 ${stageCardText}`;

// The client's decision and an overdue date use colours measured against white,
// so their chips are solid rather than translucent.
const solidChip = 'bg-white dark:bg-black/30';

export default function ContentCard({ item, campaign, onCardClick, onEdit, onDelete, isOverlay }: Props) {
  const [imgError, setImgError] = useState(false);
  const media = getMediaInfo(item.driveLink);
  const thumbnailUrl = media.previewUrl;
  const hasPreview = !!thumbnailUrl && !imgError;
  const isGraphic = mediaTypeOf(item) === 'graphic';
  const caption = captionOf(item);
  const platforms = item.platforms ?? [];
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: isOverlay,
  });

  // The whole card is the drag surface. It used to be a hover-revealed 80x45
  // button over the thumbnail, so most attempts to drag a card grabbed dead
  // space and opened the detail sheet instead.
  const dragProps = isOverlay
    ? {}
    : {
        ...attributes,
        ...listeners,
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          pressedAt.current = { x: e.clientX, y: e.clientY };
          (listeners as Record<string, ((ev: unknown) => void) | undefined>)?.onPointerDown?.(e);
        },
      };

  // The stage's colours ride along as custom properties (see stageColors.ts).
  // The cursor is an inline style because a grab cursor has to win over any
  // class, and dnd-kit's transform has to be inline anyway.
  const style = isOverlay
    ? { ...stageCardVars(item.status), cursor: 'grabbing' as const }
    : {
        ...stageCardVars(item.status),
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        // Recommended for dnd-kit's delay-based TouchSensor: keeps the page
        // scrollable and pinch-zoomable while suppressing double-tap zoom.
        touchAction: 'manipulation' as const,
      };

  function handleClick(e: React.MouseEvent) {
    const start = pressedAt.current;
    pressedAt.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP) return;
    onCardClick?.();
  }

  // Pressing a control must never begin a drag, and its click must not bubble
  // up and open the sheet.
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  const hasSchedule = !!item.scheduledAt && item.scheduledAt > 0;
  const scheduledLabel = hasSchedule
    ? new Date(item.scheduledAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  // A post whose slot has passed and which never went out is the one thing on
  // this board that is actually wrong, so it is the one thing allowed to shout.
  const overdue = hasSchedule && item.scheduledAt! < Date.now() && item.status !== 'posted';

  // The client's decision used to be visible only inside the detail sheet,
  // which meant scanning a Review column told you nothing about what was
  // actually waiting on you. Pending renders as absence: it is the normal state,
  // and a badge on every card would carry no information.
  const reviewBadge =
    item.clientReview === 'declined'
      ? { text: 'Declined', className: 'text-brand dark:text-red-400' }
      : item.clientReview === 'approved'
        ? { text: 'Approved', className: 'text-emerald-700 dark:text-emerald-400' }
        : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-stage={item.status}
      // flex-shrink-0 is not cosmetic: the column body is a capped-height flex
      // column, and flexbox shrinks its children to fit before it will scroll —
      // which clipped every card's second title line. The drag copy is tilted
      // and raised, as if picked up; the card left behind on the board lifts
      // on hover instead.
      className={`group relative overflow-hidden flex-shrink-0 rounded-card ${stageCardFill} ${
        isOverlay ? 'shadow-drag rotate-[1.5deg] scale-[1.02]' : lift
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40`}
      onClick={handleClick}
      {...dragProps}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        {/* An image earns the 16:9 frame; the absence of one does not. Without
            a preview this collapses to a type marker the size of a favicon. */}
        {hasPreview ? (
          <div
            className="relative flex-shrink-0 rounded-tile overflow-hidden bg-white/50 dark:bg-black/20"
            style={{ width: 64, aspectRatio: '16/9' }}
          >
            <img
              src={thumbnailUrl!}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
              onError={() => setImgError(true)}
            />
            {/* The grip is a hint, not the hit area — hence pointer-events-none. */}
            {!isOverlay && (
              <div
                className="absolute inset-0 hidden lg:flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                aria-hidden="true"
              >
                <GripVertical size={13} className="text-white/80" />
              </div>
            )}
          </div>
        ) : (
          <span
            className={`flex-shrink-0 w-7 h-7 rounded-tile inline-flex items-center justify-center ${chip}`}
            title={isGraphic ? 'Graphic' : 'Video'}
          >
            {isGraphic ? <ImageIcon size={14} /> : <Film size={14} />}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-[13px] font-medium text-ink dark:text-ink-dark leading-snug flex-1 min-w-0 line-clamp-2">
              {item.title}
            </p>
            {/* Pointer-only, revealed on hover. On a phone the card itself is
                the target and the detail sheet carries the same four actions
                at a size a thumb can hit. */}
            <div className="hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
              <a
                href={item.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                className={iconBtn}
                onPointerDown={stopDrag}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open in ${media.label}`}
              >
                <ExternalLink size={13} />
              </a>
              {isGraphic && media.downloadUrl && (
                <a
                  href={media.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  draggable={false}
                  className={iconBtn}
                  onPointerDown={stopDrag}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Download image"
                >
                  <Download size={13} />
                </a>
              )}
              {onEdit && (
                <button
                  onPointerDown={stopDrag}
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className={iconBtn}
                  aria-label="Edit"
                >
                  <Pencil size={13} />
                </button>
              )}
              {onDelete && (
                <button
                  onPointerDown={stopDrag}
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className={`${iconBtn} hover:!text-brand`}
                  aria-label="Delete"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* ink-soft, not ink-faint: faint measures 4.4:1 on the pastel fills. */}
          {caption && (
            <p className="text-[11px] mt-0.5 line-clamp-1 leading-relaxed text-ink-soft dark:text-ink-softdark">
              {caption}
            </p>
          )}

          {/* The campaign, then signals ordered by how much each should change
              your plans: the client's decision, then the schedule, then where
              it is going. */}
          {(campaign || reviewBadge || scheduledLabel || platforms.length > 0) && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {/* Capped at 96px: in a 280px column beside a thumbnail, anything
                  wider pushes an "Approved" badge onto a second line. The full
                  name is on hover. */}
              {campaign && (
                <ColorLabel color={campaign.color} className="max-w-[96px]" title={campaign.name}>
                  {campaign.name}
                </ColorLabel>
              )}
              {reviewBadge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ${solidChip} ${reviewBadge.className}`}
                >
                  {reviewBadge.text}
                </span>
              )}
              {scheduledLabel && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] ${
                    overdue ? `${solidChip} text-brand dark:text-red-400` : chip
                  }`}
                  title={overdue ? 'This slot has passed and it has not been posted' : undefined}
                >
                  {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                  {scheduledLabel}
                </span>
              )}
              {platforms.map((p) => (
                <span
                  key={p}
                  className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] ${chip}`}
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Turn the column into a lane**

In `src/ui.ts`, replace `columnHeader`, `columnBody` and `columnBodyOver` and their comments with:

```ts
// Pinned so you always know which stage you are looking at, however far down
// the column you have scrolled.
export const columnHeader =
  'flex items-center gap-2 h-9 px-1.5 flex-shrink-0 sticky top-0 z-10 bg-canvas dark:bg-canvas-dark';

// The cards sit straight on the page, as in the Weihu reference: a column is a
// lane, not a grey box. The padding is room for a lifted card's shadow, which
// the scroll container would otherwise clip.
export const columnBody =
  'flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 p-1.5 rounded-card border border-transparent transition-colors';
```

```ts
// The drop target while a card is over a column: a dashed outline and a faint
// wash, so the lane shows itself only when it matters. The `!` is needed
// because columnBody's border-transparent sets the same property, and Tailwind,
// not the class list, decides which of two same-property utilities wins.
export const columnBodyOver =
  'border-dashed !border-ink-faint/40 dark:!border-ink-faintdark/40 bg-tint/70 dark:bg-tint-dark/70';
```

- [ ] **Step 5: Give the column header a dot and a name**

In `src/components/KanbanColumn.tsx`:

1. Replace the import `import StagePill from './StagePill';` with:

```tsx
import { STAGES } from '../utils';
import { stageCardVars, stageDot } from '../stageColors';
```

2. Inside the component, before `return`, add:

```tsx
  const stage = STAGES.find((s) => s.id === id);
```

3. Replace the header's first two children, the `<StagePill status={id} />` line and the comment and `<span className={countChip}>` after it, with:

```tsx
          {/* A dot and the name, not a pill: on a board of tinted cards a
              tinted label would be one more swatch of the same colour. */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${stageDot}`}
            style={stageCardVars(id)}
            aria-hidden="true"
          />
          <span className="text-[13px] font-medium text-ink dark:text-ink-dark truncate">
            {stage?.label ?? id}
          </span>
          {/* A counter chip, not a bare grey number: "Editing 16" set in one
              colour at one size read as a single label. */}
          <span className={countChip}>{items.length}</span>
```

- [ ] **Step 6: Match the read-only column, and settle drops**

In `src/components/workspace/ContentBoard.tsx`:

1. Add `DropAnimation` and `defaultDropAnimationSideEffects` to the `@dnd-kit/core` import list.
2. Replace `import StagePill from '../StagePill';` with `import { stageCardVars, stageDot } from '../../stageColors';`.
3. Change `import { useIsDesktop } from '../../hooks/useMediaQuery';` to `import { useIsDesktop, useMediaQuery } from '../../hooks/useMediaQuery';`.
4. In `ReadOnlyColumn`, replace the header block:

```tsx
        <div className={columnHeader}>
          <StagePill status={status} />
          <span className={`text-[12px] font-medium truncate ${faintText}`}>{label}</span>
          <span className={`${countChip} ml-auto`}>{items.length}</span>
        </div>
```

with:

```tsx
        <div className={columnHeader}>
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${stageDot}`}
            style={stageCardVars(status)}
            aria-hidden="true"
          />
          <span className="text-[13px] font-medium text-ink dark:text-ink-dark truncate">{label}</span>
          <span className={`${countChip} ml-auto`}>{items.length}</span>
        </div>
```

5. Above `interface Props {` (the board's props), add:

```tsx
// The dropped card settles into its slot instead of snapping, while the gap it
// left stays faint until it lands. Off for anyone who asked for less motion:
// dnd-kit animates in JavaScript, which the CSS rule in index.css cannot reach.
const DROP_ANIMATION: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(.2,.8,.2,1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.25' } } }),
};
```

6. In `ContentBoard`, below `const isDesktop = useIsDesktop();`, add:

```tsx
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
```

7. Change `<DragOverlay>` to `<DragOverlay dropAnimation={reduceMotion ? null : DROP_ANIMATION}>`.

`faintText` is still used by the read-only column's empty-state text, so its import stays.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/components/ContentCard.test.tsx src/components/workspace`
Expected: PASS. Run `npm test` and expect all to pass, then `npx tsc --noEmit` and expect no output.

- [ ] **Step 8: Commit**

```bash
git add src/ui.ts src/components/ContentCard.tsx src/components/ContentCard.test.tsx src/components/KanbanColumn.tsx src/components/workspace/ContentBoard.tsx
git commit -q -F - <<'MSG'
Fill board cards with their stage's pastel

Cards take their stage's colour, with chips as a translucent layer above it,
and lift on hover. Columns lose their grey box and only outline themselves
while a card is over them. A dragged card tilts as if picked up and settles
into place on drop, unless the person has asked for reduced motion.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 4: Folder colours and the folder icon

**Files:**
- Modify: `src/folderColors.ts` (the `FolderColorDef` interface, `FOLDER_COLORS`, and a new `swatchTick`)
- Modify: `src/folderColors.test.ts`
- Modify: `src/components/ColorSwatchPicker.tsx` (`tickClass`)
- Create: `src/components/FolderIcon.tsx`
- Create: `src/components/FolderIcon.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/folderColors.test.ts`, change the import to:

```ts
import {
  DEFAULT_FOLDER_COLOR, FOLDER_COLORS, folderColor, folderColorVars, folderTint, swatchTick,
} from './folderColors';
```

and add inside the `describe('folder colours', …)` block:

```ts
  it.each(FOLDER_COLORS)('$label folder emblem reads on its front panel', (c) => {
    // The emblem is large text and decorative (the name is always beside the
    // folder), so the large-text bar of 3:1 applies.
    expect(contrastRatio(c.emblem, c.front)).toBeGreaterThanOrEqual(3);
  });

  it('puts a white tick on dark swatches and an ink tick on light ones', () => {
    expect(swatchTick('#3b82f6')).toBe('white');
    expect(swatchTick('#eab308')).toBe('ink');
  });
```

Create `src/components/FolderIcon.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import FolderIcon from './FolderIcon';

const fills = (container: HTMLElement) =>
  [...container.querySelectorAll('path, rect')].map((el) => el.getAttribute('fill'));

describe('FolderIcon', () => {
  it('is decorative, because the name is always written beside it', () => {
    const { container } = render(<FolderIcon color="green" label="Momoland" size={88} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws in its folder colour, and in blue for an unknown one', () => {
    const { container, rerender } = render(<FolderIcon color="green" />);
    expect(container.firstChild).toHaveAttribute('data-folder-color', 'green');
    expect(fills(container)).toEqual(['#22c55e', '#76db9b']);
    rerender(<FolderIcon color="chartreuse" />);
    expect(container.firstChild).toHaveAttribute('data-folder-color', 'blue');
    expect(fills(container)).toEqual(['#3b82f6', '#85b2f9']);
  });

  it('embosses the initial only where there is room for it', () => {
    const { rerender } = render(<FolderIcon label="momoland" size={88} />);
    expect(screen.getByText('M')).toBeInTheDocument();
    rerender(<FolderIcon label="momoland" size={18} />);
    expect(screen.queryByText('M')).not.toBeInTheDocument();
  });

  it('shows the logo, and the initial if the logo fails to load', () => {
    const { container } = render(
      <FolderIcon label="Momoland" imageUrl="https://x.test/logo.png" size={88} />
    );
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://x.test/logo.png');
    expect(screen.queryByText('M')).not.toBeInTheDocument();
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('keeps a logo off a folder too small to show it', () => {
    const { container } = render(
      <FolderIcon label="Momoland" imageUrl="https://x.test/logo.png" size={18} />
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps the folder proportions', () => {
    const { container } = render(<FolderIcon size={88} />);
    const box = container.firstChild as HTMLElement;
    expect(box.style.width).toBe('88px');
    expect(box.style.height).toBe('72px');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/folderColors.test.ts src/components/FolderIcon.test.tsx`
Expected: FAIL. `swatchTick` is not exported, `c.emblem` is undefined, and `./FolderIcon` does not resolve.

- [ ] **Step 3: Extend `src/folderColors.ts`**

Add `import { contrastRatio } from './color';` at the top, below the existing imports.

Add two fields to `FolderColorDef`, after `swatch`:

```ts
  /** The folder's front panel: the swatch lightened. The same in both themes, as in Finder. */
  front: string;
  /** The letter embossed on the front. At least 3:1 on `front` (large text). */
  emblem: string;
```

Replace `FOLDER_COLORS` with this. Only `front` and `emblem` are new, and the existing values are unchanged:

```ts
export const FOLDER_COLORS: FolderColorDef[] = [
  { id: 'blue', label: 'Blue', swatch: '#3b82f6', front: '#85b2f9', emblem: '#1e417b',
    tint: '#e8f0fe', text: '#1d4ed8', tintDark: '#1c2a45', textDark: '#93b4f8' },
  { id: 'sky', label: 'Sky', swatch: '#0ea5e9', front: '#6ac7f1', emblem: '#075375',
    tint: '#e0f4fc', text: '#0369a1', tintDark: '#102f3d', textDark: '#7dd3fc' },
  { id: 'teal', label: 'Teal', swatch: '#14b8a6', front: '#6dd3c8', emblem: '#0a5c53',
    tint: '#ddf6f2', text: '#115e59', tintDark: '#0f302c', textDark: '#5eead4' },
  { id: 'green', label: 'Green', swatch: '#22c55e', front: '#76db9b', emblem: '#11632f',
    tint: '#e3f8ea', text: '#166534', tintDark: '#12301d', textDark: '#86efac' },
  { id: 'yellow', label: 'Yellow', swatch: '#eab308', front: '#f2d066', emblem: '#755a04',
    tint: '#fdf6d8', text: '#854d0e', tintDark: '#33290c', textDark: '#fcd34d' },
  { id: 'orange', label: 'Orange', swatch: '#f97316', front: '#fba86f', emblem: '#7d3a0b',
    tint: '#feeedd', text: '#9a3412', tintDark: '#3a2213', textDark: '#fdba74' },
  { id: 'red', label: 'Red', swatch: '#ef4444', front: '#f58b8b', emblem: '#782222',
    tint: '#fde8e8', text: '#b91c1c', tintDark: '#3d1a1a', textDark: '#fca5a5' },
  { id: 'pink', label: 'Pink', swatch: '#ec4899', front: '#f38ec0', emblem: '#76244d',
    tint: '#fce7f3', text: '#be185d', tintDark: '#3b1729', textDark: '#f9a8d4' },
  { id: 'purple', label: 'Purple', swatch: '#8b5cf6', front: '#b79af9', emblem: '#462e7b',
    tint: '#efe9fe', text: '#6d28d9', tintDark: '#2a1f45', textDark: '#c4b5fd' },
  { id: 'graphite', label: 'Graphite', swatch: '#6b7280', front: '#a3a8b0', emblem: '#363940',
    tint: '#eeeff1', text: '#4b5563', tintDark: '#2a2c30', textDark: '#c4c8cf' },
];
```

Append at the end of the file:

```ts
/**
 * Which tick reads on a swatch: white all but disappears on yellow, green and
 * teal, so those take an ink tick. 3:1 is the bar for a graphic.
 */
export function swatchTick(swatch: string): 'white' | 'ink' {
  return contrastRatio('#ffffff', swatch) >= 3 ? 'white' : 'ink';
}
```

- [ ] **Step 4: Use `swatchTick` in the picker**

In `src/components/ColorSwatchPicker.tsx`:

1. Remove `import { contrastRatio } from '../color';`.
2. Change `import { FOLDER_COLORS } from '../folderColors';` to `import { FOLDER_COLORS, swatchTick } from '../folderColors';`.
3. Replace the body of `tickClass` with:

```ts
  return swatchTick(swatch) === 'white' ? 'text-white' : 'text-ink';
```

The comment above it stays.

- [ ] **Step 5: Create `src/components/FolderIcon.tsx`**

```tsx
import { useState } from 'react';
import { folderColor } from '../folderColors';

interface Props {
  /** A folder colour id. Anything unknown draws the default blue. */
  color?: string;
  /** Rendered width in px. The height follows the folder's proportions. */
  size?: number;
  /** Its first letter is embossed on the front, from 40px up. */
  label?: string;
  /** A logo shown on the front instead of the letter, from 40px up. */
  imageUrl?: string;
  className?: string;
}

// Below this a letter or a logo is a smudge, so the folder is drawn plain.
const EMBLEM_MIN = 40;

// A macOS-style folder in one of the ten folder colours, chosen the way you
// colour a folder in Finder or OneDrive. Always decorative: everywhere it
// appears, the name is written beside it. Inside a `group`, hovering the group
// lifts the folder and dips its front panel, as if it were opening.
//
// The emblem is HTML over the SVG rather than SVG <image>, because an HTML
// image reliably reports a failed load, and a failed logo falls back to the
// letter.
export default function FolderIcon({ color, size = 20, label, imageUrl, className = '' }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const c = folderColor(color);
  const height = Math.round(size * 0.8125);
  const roomy = size >= EMBLEM_MIN;
  const showLogo = roomy && !!imageUrl && !logoFailed;
  const initial = roomy ? label?.trim().charAt(0).toUpperCase() : undefined;

  return (
    <span
      aria-hidden="true"
      data-folder-color={c.id}
      className={`relative inline-block flex-shrink-0 transition-transform duration-150 ease-out-soft [@media(hover:hover)]:group-hover:-translate-y-0.5 ${className}`}
      style={{ width: size, height }}
    >
      <svg viewBox="0 0 64 52" width={size} height={height} className="block overflow-visible">
        {/* The back panel and its tab, in the full colour. */}
        <path
          d="M2 7a4 4 0 0 1 4-4h14.6a4 4 0 0 1 3.2 1.6L26.4 8H58a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
          fill={c.swatch}
        />
        {/* The front panel, lighter, hinged at the bottom. */}
        <rect
          x="2"
          y="14"
          width="60"
          height="36"
          rx="4"
          fill={c.front}
          className="[transform-box:fill-box] origin-bottom transition-transform duration-150 ease-out-soft [@media(hover:hover)]:group-hover:[transform:scaleY(.94)]"
        />
      </svg>
      {(showLogo || initial) && (
        <span className="absolute inset-x-0 bottom-0 top-[28%] flex items-center justify-center">
          {showLogo ? (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              onError={() => setLogoFailed(true)}
              className="rounded-[22%] object-cover ring-2 ring-white/70"
              style={{ width: Math.round(size * 0.36), height: Math.round(size * 0.36) }}
            />
          ) : (
            <span
              className="font-semibold leading-none"
              style={{ color: c.emblem, fontSize: Math.round(size * 0.26) }}
            >
              {initial}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/folderColors.test.ts src/components/FolderIcon.test.tsx src/components/ColorSwatchPicker.test.tsx`
Expected: PASS. Then run `npx tsc --noEmit` and expect no output.

- [ ] **Step 7: Commit**

```bash
git add src/folderColors.ts src/folderColors.test.ts src/components/ColorSwatchPicker.tsx src/components/FolderIcon.tsx src/components/FolderIcon.test.tsx
git commit -q -F - <<'MSG'
Draw clients and businesses as macOS-style colour folders

FolderIcon draws a folder in any of the ten folder colours, with a lighter
front panel and, from 40px up, the logo or the initial on it. Each colour
gains a front and an emblem shade, tested so the letter reads on the panel.
The swatch picker's tick colour moves into folderColors with them.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 5: The Clients page as a folder grid

**Files:**
- Create: `src/components/ClientFolder.tsx`
- Create: `src/components/ClientFolder.test.tsx`
- Modify: `src/pages/ClientsPage.tsx` (imports; the grid at the end of the body)
- Delete: `src/components/ClientCard.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ClientFolder.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ClientFolder from './ClientFolder';
import { Client, ContentItem } from '../types';

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing', createdAt: 1,
    uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(content: ContentItem[]): Client {
  return { id: 'momo', name: 'Momoland', about: '', color: 'orange', content, businesses: [], createdAt: 1 };
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup(c: Client, onEdit?: () => void) {
  render(
    <MemoryRouter initialEntries={['/clients']}>
      <Routes>
        <Route path="*" element={<><ClientFolder client={c} onEdit={onEdit} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClientFolder', () => {
  it('names the client under a folder in its colour', () => {
    setup(client([]));
    expect(screen.getByText('Momoland')).toBeInTheDocument();
    expect(document.querySelector('[data-folder-color="orange"]')).not.toBeNull();
  });

  it('says what is waiting on the client before how much there is', () => {
    setup(client([
      item({ id: 'a', status: 'review' }),
      item({ id: 'b', status: 'review' }),
      item({ id: 'c' }),
    ]));
    expect(screen.getByText('2 to review')).toBeInTheDocument();
    expect(screen.queryByText('3 items')).not.toBeInTheDocument();
  });

  it('counts the items when nothing is waiting', () => {
    setup(client([item({ id: 'a' }), item({ id: 'b', status: 'posted' })]));
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('says so when there is no content', () => {
    setup(client([]));
    expect(screen.getByText('No content yet')).toBeInTheDocument();
  });

  it('opens the client', async () => {
    setup(client([]));
    await userEvent.click(screen.getByRole('button', { name: /Momoland/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/client/momo');
  });

  it('offers Edit to someone who may edit, without opening the client', async () => {
    const onEdit = vi.fn();
    setup(client([]), onEdit);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Momoland' }));
    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/clients');
  });

  it('has no Edit for a viewer who may not edit', () => {
    setup(client([]));
    expect(screen.queryByRole('button', { name: 'Edit Momoland' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/ClientFolder.test.tsx`
Expected: FAIL. `./ClientFolder` does not resolve.

- [ ] **Step 3: Create `src/components/ClientFolder.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Client } from '../types';
import { awaitingReview } from '../nav';
import FolderIcon from './FolderIcon';
import ColorLabel from './ColorLabel';
import { btnIcon, faintText } from '../ui';

interface Props {
  client: Client;
  /** Absent when the viewer may not edit clients. */
  onEdit?: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// A client as a folder, the way Finder or OneDrive lays out a grid: the folder
// in the client's colour with its logo or initial on the front, and the name
// underneath. The one line of detail says what most needs saying — what is
// waiting on the client first, then how much there is.
//
// Two sibling buttons, not one inside the other (invalid HTML): the tile opens
// the client and the pencil edits it. The pencil is always visible where
// nothing can hover to reveal it.
export default function ClientFolder({ client, onEdit }: Props) {
  const navigate = useNavigate();
  const waiting = awaitingReview(client.content);

  return (
    <div className="group relative">
      <button
        onClick={() => navigate(`/client/${client.id}`)}
        className="w-full flex flex-col items-center gap-2 px-2 pt-4 pb-3 rounded-card text-center transition-[background-color,transform] duration-150 ease-out-soft hover:bg-tint dark:hover:bg-tint-dark active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        <FolderIcon color={client.color} size={88} label={client.name} imageUrl={client.imageUrl} />
        <span className="text-[13px] font-medium leading-snug text-ink dark:text-ink-dark line-clamp-2 break-words">
          {client.name}
        </span>
        {waiting > 0 ? (
          <ColorLabel color="sky">{waiting} to review</ColorLabel>
        ) : (
          <span className={`text-[11px] ${faintText}`}>
            {client.content.length > 0 ? plural(client.content.length, 'item') : 'No content yet'}
          </span>
        )}
      </button>
      {onEdit && (
        <button
          onClick={onEdit}
          className={`${btnIcon} absolute top-1 right-1 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus:opacity-100`}
          aria-label={`Edit ${client.name}`}
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Use it on the Clients page**

In `src/pages/ClientsPage.tsx`:

1. Replace `import ClientCard from '../components/ClientCard';` with:

```tsx
import ClientFolder from '../components/ClientFolder';
import { enter, staggerStyle } from '../motion';
```

2. Replace the grid at the end of the body:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visibleClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={canManageClients ? () => setEditingClient(client) : undefined}
            />
          ))}
        </div>
```

with:

```tsx
        // Folders in a grid, like Finder or OneDrive: as many columns as fit,
        // each at least 132px, entering in a quick stagger.
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3 gap-y-4 sm:gap-x-4">
          {visibleClients.map((client, i) => (
            <div key={client.id} className={enter} style={staggerStyle(i)}>
              <ClientFolder
                client={client}
                onEdit={canManageClients ? () => setEditingClient(client) : undefined}
              />
            </div>
          ))}
        </div>
```

The `//` comment is valid where it sits: inside the ternary's parentheses, which is plain JavaScript, not JSX children.

3. Delete `src/components/ClientCard.tsx`:

```bash
git rm -q src/components/ClientCard.tsx
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/ClientFolder.test.tsx`
Expected: PASS. Then `npm test` and expect all to pass, and `npx tsc --noEmit` with no output. Nothing else imports `ClientCard`; tsc would report it if anything did.

- [ ] **Step 6: Commit**

```bash
git add src/components/ClientFolder.tsx src/components/ClientFolder.test.tsx src/pages/ClientsPage.tsx
git commit -q -F - <<'MSG'
Show the Clients page as a grid of colour folders

Each client is a folder in its colour, with its logo or initial on the
front, its name underneath, and one line of detail: what is waiting on
the client first, otherwise how much there is. The team's Edit sits
beside the tile rather than inside it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 6: Folders everywhere a client or business is named

**Files:**
- Modify: `src/components/Sidebar.tsx` (import; client rows)
- Modify: `src/components/AppShell.tsx` (import; breadcrumb)
- Modify: `src/components/QueueGroup.tsx` (import; `QueueRow`)
- Modify: `src/components/CommandPalette.tsx` (import; `Leading`)
- Modify: `src/components/workspace/BusinessCard.tsx` (import; leading mark)
- Modify: `src/components/workspace/BusinessScopeBar.tsx` (imports; chip dot)
- Delete: `src/components/ClientAvatar.tsx`
- Test: `src/components/Sidebar.test.tsx`, `src/components/QueueGroup.test.tsx`, `src/components/workspace/WorkspaceChrome.test.tsx`, `src/components/workspace/OverviewTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to the `describe('Sidebar', …)` block in `src/components/Sidebar.test.tsx`:

```tsx
  it('draws each client as a folder in its colour', () => {
    setup({
      nav: {
        clients: [
          { id: 'acme', name: 'Acme', color: 'green', attention: 0 },
          { id: 'bolt', name: 'Bolt', attention: 0 },
        ],
        showTeam: false,
      },
    });
    const colours = [...document.querySelectorAll('[data-folder-color]')].map((el) =>
      el.getAttribute('data-folder-color')
    );
    // A client without a colour gets the default blue folder.
    expect(colours).toEqual(['green', 'blue']);
  });
```

Add to the `describe('QueueGroup', …)` block in `src/components/QueueGroup.test.tsx`:

```tsx
  it('marks a row with a folder in its client colour', () => {
    render(
      <ThemeProvider>
        <QueueGroup section={QUEUE_SECTIONS[0]} entries={[entry('Menu reel')]} now={NOW} onOpen={vi.fn()} />
      </ThemeProvider>
    );
    expect(document.querySelector('[data-folder-color="green"]')).not.toBeNull();
  });
```

Add to the `describe('BusinessScopeBar', …)` block in `src/components/workspace/WorkspaceChrome.test.tsx`:

```tsx
  it('marks each business with a small folder in its colour', () => {
    render(<BusinessScopeBar businesses={[BAKERY, CAFE]} value={undefined} onChange={vi.fn()} />);
    const colours = [...document.querySelectorAll('[data-folder-color]')].map((el) =>
      el.getAttribute('data-folder-color')
    );
    expect(colours).toEqual(['orange', 'green']);
  });
```

Add to the `describe('OverviewTab', …)` block in `src/components/workspace/OverviewTab.test.tsx`:

```tsx
  it('shows each business as a folder in its colour', () => {
    renderOverview(client([BAKERY, CAFE]));
    const region = screen.getByRole('region', { name: 'Businesses' });
    const colours = [...region.querySelectorAll('[data-folder-color]')].map((el) =>
      el.getAttribute('data-folder-color')
    );
    expect(colours).toEqual(['orange', 'green']);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/Sidebar.test.tsx src/components/QueueGroup.test.tsx src/components/workspace/WorkspaceChrome.test.tsx src/components/workspace/OverviewTab.test.tsx`
Expected: FAIL. The four new tests find no `[data-folder-color]` elements.

- [ ] **Step 3: Swap the lettered avatar for the folder**

In each file below, replace the `ClientAvatar` import with `import FolderIcon from './FolderIcon';`, or `'../FolderIcon'` from `workspace/`, then make the change shown.

`src/components/Sidebar.tsx`, in the client row:

```tsx
              <FolderIcon color={c.color} size={18} />
```

replacing `<ClientAvatar name={c.name} imageUrl={c.imageUrl} color={c.color} size={18} />`.

`src/components/AppShell.tsx`, in the breadcrumb:

```tsx
          {/* The client's folder beside the back button. A board is the one
              place where which client you are looking at is the whole context,
              and a truncated name alone is the slowest way to convey it. */}
          {activeClient && <FolderIcon color={activeClient.color} size={22} />}
```

replacing the existing comment and the `{activeClient && (<ClientAvatar … />)}` block.

`src/components/QueueGroup.tsx`, in `QueueRow`:

```tsx
      {showSource && <FolderIcon color={entry.clientColor} size={16} />}
```

replacing the `{showSource && (<ClientAvatar … />)}` block. In the `showSource` doc comment, change "The avatar and name" to "The folder and name".

`src/components/CommandPalette.tsx`, in `Leading`:

```tsx
  if (item.kind === 'client') {
    return <FolderIcon color={item.color} size={20} />;
  }
```

`src/components/workspace/BusinessCard.tsx`, as the card's leading mark:

```tsx
        <FolderIcon color={business.color} size={40} label={business.name} imageUrl={business.logoUrl} />
```

replacing `<ClientAvatar name={business.name} imageUrl={business.logoUrl} color={business.color} size={36} />`.

`src/components/workspace/BusinessScopeBar.tsx`:
1. Remove `import { folderColor } from '../../folderColors';`.
2. Add `import FolderIcon from '../FolderIcon';`.
3. Replace the dot `<span className="w-2 h-2 rounded-full …" style={{ backgroundColor: folderColor(b.color).swatch }} aria-hidden="true" />` with:

```tsx
          <FolderIcon color={b.color} size={14} />
```

and change the header comment's last sentence to: `The folder is never the only cue: every chip carries the business name.`

- [ ] **Step 4: Delete `ClientAvatar`**

```bash
git rm -q src/components/ClientAvatar.tsx
```

Run `npx tsc --noEmit`. Expected: no output. If anything still imports `ClientAvatar`, tsc names the file; replace that import as in Step 3.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all pass, including the four new tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx src/components/AppShell.tsx src/components/QueueGroup.tsx src/components/CommandPalette.tsx src/components/workspace/BusinessCard.tsx src/components/workspace/BusinessScopeBar.tsx src/components/Sidebar.test.tsx src/components/QueueGroup.test.tsx src/components/workspace/WorkspaceChrome.test.tsx src/components/workspace/OverviewTab.test.tsx
git commit -q -F - <<'MSG'
Mark every client and business with its folder

The sidebar, the client header, Today's rows and search show a small folder
in the client's colour where the lettered square used to be. Business cards
and the business scope chips use the business's folder. ClientAvatar is gone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 7: A folder preview in the client form

**Files:**
- Modify: `src/components/ClientModal.tsx` (imports; the "Folder colour" field)
- Test: `src/components/ClientModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to the `describe('ClientModal', …)` block in `src/components/ClientModal.test.tsx`:

```tsx
  it('previews the folder in the colour being chosen', async () => {
    render(<ClientModal onClose={vi.fn()} onSave={vi.fn()} />);
    expect(document.querySelector('[data-folder-color="blue"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
    expect(document.querySelector('[data-folder-color="pink"]')).not.toBeNull();
    expect(document.querySelector('[data-folder-color="blue"]')).toBeNull();
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/ClientModal.test.tsx`
Expected: FAIL. No `[data-folder-color]` element is found.

- [ ] **Step 3: Add the preview**

In `src/components/ClientModal.tsx`, add `import FolderIcon from './FolderIcon';` and replace the folder colour field:

```tsx
          {/* Like picking a folder colour in OneDrive: the colour marks this
              client everywhere it appears. */}
          <div>
            <span className={label}>Folder colour</span>
            <ColorSwatchPicker value={color} onChange={setColor} label="Folder colour" />
          </div>
```

with:

```tsx
          {/* Like colouring a folder in OneDrive: the colour marks this client
              everywhere it appears, and the preview shows the folder as it will
              look, logo and all. */}
          <div>
            <span className={label}>Folder colour</span>
            <div className="flex items-center gap-4">
              <FolderIcon
                color={color}
                size={56}
                label={name}
                imageUrl={imageUrl.trim() || undefined}
              />
              <div className="flex-1 min-w-0">
                <ColorSwatchPicker value={color} onChange={setColor} label="Folder colour" />
              </div>
            </div>
          </div>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/ClientModal.test.tsx src/components/ColorSwatchPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ClientModal.tsx src/components/ClientModal.test.tsx
git commit -q -F - <<'MSG'
Preview the client's folder while choosing its colour

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 8: A sliding underline on the workspace tabs

**Files:**
- Modify: `src/ui.ts` (`workspaceTab`)
- Modify: `src/components/workspace/WorkspaceTabs.tsx`
- Test: `src/components/workspace/WorkspaceChrome.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to the `describe('WorkspaceTabs', …)` block in `src/components/workspace/WorkspaceChrome.test.tsx`:

```tsx
  it('slides one underline to the current place once the tabs can be measured', () => {
    // jsdom lays nothing out, so give every tab an 80px box, side by side.
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    const left = vi
      .spyOn(HTMLElement.prototype, 'offsetLeft', 'get')
      .mockImplementation(function (this: HTMLElement) {
        const tabs = [...(this.parentElement?.querySelectorAll(':scope > button') ?? [])];
        return tabs.indexOf(this) * 80;
      });
    try {
      render(<WorkspaceTabs tabs={tabsFor('admin')} active="campaigns" onSelect={vi.fn()} />);
      const index = tabsFor('admin').findIndex((t) => t.id === 'campaigns');
      const bar = screen.getByTestId('tab-indicator');
      expect(bar.style.width).toBe('80px');
      expect(bar.style.left).toBe(`${index * 80}px`);
    } finally {
      width.mockRestore();
      left.mockRestore();
    }
  });

  it('keeps the underline on the tab itself where nothing can be measured', () => {
    render(<WorkspaceTabs tabs={tabsFor('admin')} active="content" onSelect={vi.fn()} />);
    expect(screen.queryByTestId('tab-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Content' }).className).toContain('border-ink');
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/workspace/WorkspaceChrome.test.tsx`
Expected: FAIL. The first new test finds no `tab-indicator`. The second passes already, and must still pass after the change.

- [ ] **Step 3: Let a tab hand its underline to the indicator**

In `src/ui.ts`, replace `workspaceTab` with:

```ts
// `indicator` is true once WorkspaceTabs has measured the row and draws the
// one sliding underline itself; until then the current tab draws its own.
export function workspaceTab(active: boolean, indicator = false) {
  return `inline-flex items-center h-full px-2 border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:bg-hover dark:focus-visible:bg-hover-dark ${
    active
      ? `${indicator ? 'border-transparent' : 'border-ink dark:border-ink-dark'} text-ink dark:text-ink-dark`
      : 'border-transparent text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}
```

- [ ] **Step 4: Rewrite `src/components/workspace/WorkspaceTabs.tsx`**

```tsx
import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { TabDef, WorkspaceTab } from '../../workspace';
import { workspaceTab, workspaceTabList, workspaceTabRow } from '../../ui';

interface Props {
  tabs: TabDef[];
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  /** Right-aligned controls, outside the scrolling list so a menu can drop out of the bar. */
  actions?: ReactNode;
}

interface Bar {
  left: number;
  width: number;
}

// A client's places, in one row under the breadcrumb. Each one is its own URL,
// so this is navigation with the current place marked, not a tablist: a
// tablist promises arrow keys and tab panels, and someone who tries them would
// get nothing.
//
// One underline slides between the places rather than each tab drawing its
// own, so moving to another tab reads as moving along the row. It is placed
// from the current tab's measured box; where nothing can be measured (jsdom,
// or before layout), the current tab keeps an underline of its own.
export default function WorkspaceTabs({ tabs, active, onSelect, actions }: Props) {
  const listRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<WorkspaceTab, HTMLButtonElement>());
  const [bar, setBar] = useState<Bar | null>(null);
  // The ids, not the array: a caller that rebuilds the array every render must
  // not re-run the measurement every render.
  const tabKey = tabs.map((t) => t.id).join(',');

  useLayoutEffect(() => {
    function measure() {
      const el = tabRefs.current.get(active);
      const next = el && el.offsetWidth > 0 ? { left: el.offsetLeft, width: el.offsetWidth } : null;
      // The same box keeps the same object, or every resize would re-render.
      setBar((prev) =>
        prev && next && prev.left === next.left && prev.width === next.width ? prev : next
      );
    }
    measure();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active, tabKey]);

  return (
    <div className={workspaceTabRow}>
      <nav ref={listRef} aria-label="Client workspace" className={`${workspaceTabList} relative`}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              if (el) tabRefs.current.set(t.id, el);
              else tabRefs.current.delete(t.id);
            }}
            onClick={() => onSelect(t.id)}
            aria-current={t.id === active ? 'page' : undefined}
            className={workspaceTab(t.id === active, !!bar)}
          >
            {t.label}
          </button>
        ))}
        {bar && (
          <span
            data-testid="tab-indicator"
            aria-hidden="true"
            className="absolute bottom-0 h-0.5 rounded-full bg-ink dark:bg-ink-dark pointer-events-none transition-[left,width] duration-200 ease-out-soft"
            style={{ left: bar.left, width: bar.width }}
          />
        )}
      </nav>
      {actions && <div className="flex items-center flex-shrink-0">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/workspace/WorkspaceChrome.test.tsx src/pages/ClientWorkspacePage.test.tsx`
Expected: PASS. Then `npx tsc --noEmit`, which must print nothing.

- [ ] **Step 6: Commit**

```bash
git add src/ui.ts src/components/workspace/WorkspaceTabs.tsx src/components/workspace/WorkspaceChrome.test.tsx
git commit -q -F - <<'MSG'
Slide one underline between the workspace tabs

The underline is placed from the current tab's measured box and follows
it to the next, so changing tab reads as moving along the row. Where
nothing can be measured, the current tab keeps an underline of its own.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 9: Overview in the board's colours, and lists that enter in turn

**Files:**
- Modify: `src/components/workspace/OverviewTab.tsx` (imports; the three top-level blocks)
- Modify: `src/components/QueueGroup.tsx` (`QueueRow` gains `index`; `QueueGroup` passes it)
- Test: `src/components/QueueGroup.test.tsx`, `src/components/workspace/OverviewTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/QueueGroup.test.tsx`:

```tsx
  it('brings its rows in one after another', () => {
    render(
      <ThemeProvider>
        <QueueGroup
          section={QUEUE_SECTIONS[0]}
          entries={[entry('One'), entry('Two')]}
          now={NOW}
          onOpen={vi.fn()}
        />
      </ThemeProvider>
    );
    const rows = screen.getAllByRole('button');
    expect(rows.map((r) => r.style.animationDelay)).toEqual(['0ms', '30ms']);
  });
```

Add to `src/components/workspace/OverviewTab.test.tsx`:

```tsx
  it("shows each stage's count in that stage's colour", () => {
    renderOverview(client([BAKERY], [item({ id: 'a', status: 'review' }), item({ id: 'b', status: 'review' })]));
    const pipeline = screen.getByRole('region', { name: 'Pipeline' });
    const review = [...pipeline.querySelectorAll<HTMLElement>('[data-stage]')].find(
      (el) => el.dataset.stage === 'review'
    )!;
    expect(review).toHaveTextContent('Review2');
    expect(review.style.getPropertyValue('--sc-tint')).toBe('#dcedf9');
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/QueueGroup.test.tsx src/components/workspace/OverviewTab.test.tsx`
Expected: FAIL. The rows have no animation delay, and the pipeline has no `[data-stage]` tiles.

- [ ] **Step 3: Stagger the queue rows**

In `src/components/QueueGroup.tsx`:

1. Add `import { enter, staggerStyle } from '../motion';`.
2. Give `QueueRow` an `index` prop. Add `index = 0` to its destructuring and to its props type:

```tsx
  /** Its place in the list, for the entrance stagger. */
  index?: number;
```

3. On the row's `<button>`, change `className={queueRow}` to `className={`${queueRow} ${enter}`}` and add `style={staggerStyle(index)}`.
4. In `QueueGroup`, map with the index and pass it on: `{entries.map((e, i) => (<QueueRow key={…} entry={e} index={i} … />))}`.

- [ ] **Step 4: Colour the pipeline and stagger the Overview**

In `src/components/workspace/OverviewTab.tsx`:

1. Replace `import StagePill from '../StagePill';` with:

```tsx
import { stageCardFill, stageCardText, stageCardVars } from '../../stageColors';
import { enter, staggerStyle } from '../../motion';
```

2. Remove `tile` from the `../../ui` import, since the pipeline no longer uses it.
3. On the businesses `<section aria-label="Businesses">`, add `className={enter} style={staggerStyle(0)}`.
4. Replace the pipeline section with:

```tsx
        {/* The four counts in the board's own colours, so they read as its
            four columns. */}
        <section
          aria-label="Pipeline"
          className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${enter}`}
          style={staggerStyle(1)}
        >
          {STAGES.map((s) => (
            <div
              key={s.id}
              data-stage={s.id}
              className={`rounded-card p-3.5 ${stageCardFill}`}
              style={stageCardVars(s.id)}
            >
              <span className={`text-[12px] font-medium ${stageCardText}`}>{s.label}</span>
              <p className={`${heading} text-2xl mt-1 tabular-nums`}>
                {content.filter((i) => i.status === s.id).length}
              </p>
            </div>
          ))}
        </section>
```

5. On the two-column grid below it, the `<div className="grid grid-cols-1 lg:grid-cols-[…] gap-7 items-start">`, append `${enter}` to the class list using a template string, and add `style={staggerStyle(2)}`.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all pass. Then `npx tsc --noEmit`, which must print nothing.

- [ ] **Step 6: Commit**

```bash
git add src/components/QueueGroup.tsx src/components/QueueGroup.test.tsx src/components/workspace/OverviewTab.tsx src/components/workspace/OverviewTab.test.tsx
git commit -q -F - <<'MSG'
Colour the Overview's pipeline like the board, and stagger lists in

The four stage counts take their stage's pastel, so they read as the
board's four columns. Today's rows and the Overview's blocks fade up one
after another when they first appear.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 10: Ideas on the design tokens

`IdeasView` predates the August redesign and still carries 99 raw colours in the retired near-black style.

**Files:**
- Modify: `src/components/IdeasView.tsx` (whole file)
- Test: `src/components/IdeasView.test.tsx` (button names)

- [ ] **Step 1: Update the test to the sentence-case labels**

In `src/components/IdeasView.test.tsx`, replace every `{ name: /New Idea/ }` with `{ name: /New idea/ }`, and every `{ name: 'Submit Idea' }` with `{ name: 'Submit idea' }`. Then check nothing else uses the old labels:

Run: `grep -rn "New Idea\|Submit Idea" src`
Expected: matches only in `src/components/IdeasView.tsx`, which Step 3 rewrites.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/components/IdeasView.test.tsx`
Expected: FAIL. No button is named "New idea".

- [ ] **Step 3: Replace `src/components/IdeasView.tsx`**

```tsx
import { useState } from 'react';
import { Lightbulb, Plus, X, Link as LinkIcon, Check, Ban, Trash2, ArrowRight } from 'lucide-react';
import { Business, FolderColor, Idea, IdeaStatus } from '../types';
import { businessIdOf } from '../campaigns';
import { useIdeas } from '../store';
import { runWrite } from '../utils';
import CommentThread from './CommentThread';
import ColorLabel from './ColorLabel';
import {
  overlay, modalPanel, modalTitle, btnIcon, btnPrimary, btnGhost, label, labelAside, hint,
  input, textarea, card, heading, bodyText, faintText, readout,
  emptyState, emptyTitle, emptyBody,
} from '../ui';

// Each status as a tinted label in one of the folder colours, which are
// contrast-tested in both themes.
const STATUS_META: Record<IdeaStatus, { label: string; color: FolderColor }> = {
  new: { label: 'New', color: 'blue' },
  accepted: { label: 'Accepted', color: 'green' },
  declined: { label: 'Declined', color: 'graphite' },
};

// A small icon action on an idea. Each one colours itself on hover by what it does.
const ideaAction =
  'w-8 h-8 inline-flex items-center justify-center rounded-tile text-ink-faint dark:text-ink-faintdark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30';

function IdeaForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; links: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const ok = await runWrite(
      () =>
        onSubmit({
          title: title.trim(),
          description: description.trim(),
          links: links
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      'save the idea'
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="idea-form-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="idea-form-title" className={modalTitle}>New idea</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="idea-title" className={label}>Title</label>
            <input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Behind the scenes of the new store"
              required
              className={input}
            />
          </div>

          <div>
            <label htmlFor="idea-description" className={label}>Description</label>
            <textarea
              id="idea-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the idea, and why now?"
              rows={4}
              className={textarea}
            />
          </div>

          <div>
            <label htmlFor="idea-links" className={label}>
              Links <span className={labelAside}>(one per line)</span>
            </label>
            {/* !text-xs: the textarea recipe already sets text-sm, and of two
                font sizes Tailwind's own order picks the winner, not the list. */}
            <textarea
              id="idea-links"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={'https://drive.google.com/...\nhttps://example.com/reference'}
              rows={3}
              className={`${textarea} font-mono !text-xs`}
            />
            <p className={hint}>References, Drive files, anything worth pointing at.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={!title.trim() || saving} className={`${btnPrimary} flex-1`}>
              {saving ? 'Saving…' : 'Submit idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleDecision(idea: Idea, status: IdeaStatus) {
    const note =
      status === 'declined'
        ? prompt('Why is this being declined? (optional — the client will see it)') ?? ''
        : '';
    await runWrite(() => setIdeaStatus(idea.id, status, note), 'update the idea');
  }

  async function handleDelete(idea: Idea) {
    if (!confirm(`Delete "${idea.title}"? This can't be undone.`)) return;
    await runWrite(() => deleteIdea(idea.id), 'delete the idea');
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className={`${heading} text-sm`}>Ideas</h2>
          <p className={`text-xs mt-0.5 ${faintText}`}>{ideas.length} submitted</p>
        </div>
        <button onClick={() => setShowForm(true)} className={btnPrimary}>
          <Plus size={15} />
          New idea
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
        </div>
      ) : ideas.length === 0 ? (
        <div className={emptyState}>
          <div className={`${card} w-12 h-12 flex items-center justify-center`}>
            <Lightbulb size={20} className={faintText} />
          </div>
          <p className={emptyTitle}>No ideas yet</p>
          <p className={emptyBody}>
            Anything worth making — a concept, a reference, a rough thought — starts here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ideas.map((idea) => {
            const meta = STATUS_META[idea.status];
            const isOpen = expanded === idea.id;
            return (
              <div key={idea.id} className={`${card} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`${heading} text-sm`}>{idea.title}</h3>
                      <ColorLabel color={meta.color}>{meta.label}</ColorLabel>
                      {idea.convertedContentId && (
                        <span className={`text-[11px] ${faintText}`}>· on the board</span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${faintText}`}>
                      {idea.createdByName} ·{' '}
                      {new Date(idea.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {idea.description && (
                      <p className={`text-sm mt-2 leading-relaxed whitespace-pre-wrap ${bodyText}`}>
                        {idea.description}
                      </p>
                    )}

                    {idea.links.length > 0 && (
                      <div className="flex flex-col gap-1 mt-2">
                        {idea.links.map((l) => (
                          <a
                            key={l}
                            href={l}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 text-xs truncate transition-colors hover:text-brand ${faintText}`}
                          >
                            <LinkIcon size={11} className="flex-shrink-0" />
                            <span className="truncate">{l}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {idea.decisionNote && <p className={`${readout} mt-2`}>{idea.decisionNote}</p>}
                  </div>

                  {canTriage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {idea.status !== 'accepted' && (
                        <button
                          onClick={() => handleDecision(idea, 'accepted')}
                          className={`${ideaAction} hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40`}
                          aria-label="Accept"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {idea.status !== 'declined' && (
                        <button
                          onClick={() => handleDecision(idea, 'declined')}
                          className={`${ideaAction} hover:text-ink dark:hover:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark`}
                          aria-label="Decline"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(idea)}
                        className={`${ideaAction} hover:text-brand hover:bg-brand-soft dark:hover:bg-brand-softdark`}
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => setExpanded(isOpen ? null : idea.id)}
                    className={`text-xs transition-colors hover:text-ink dark:hover:text-ink-dark ${faintText}`}
                  >
                    {isOpen ? 'Hide discussion' : 'Discussion'}
                  </button>
                  {canTriage && idea.status === 'accepted' && !idea.convertedContentId && (
                    <button
                      onClick={() => onConvert(idea)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
                    >
                      Make content
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3">
                    <CommentThread
                      clientId={clientId}
                      contentId={idea.id}
                      parent="ideas"
                      showTimestamp={false}
                      onSend={(body) => addIdeaComment(idea.id, body)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <IdeaForm
          onClose={() => setShowForm(false)}
          onSubmit={(data) => addIdea({ ...data, ...(businessId ? { businessId } : {}) })}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/IdeasView.test.tsx`
Expected: PASS. Then run `npm test` and `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/components/IdeasView.tsx src/components/IdeasView.test.tsx
git commit -q -F - <<'MSG'
Move Ideas onto the design tokens

Ideas still carried 99 raw colours from the retired near-black look. It now
uses the shared form, card, label and empty-state recipes, shows each
status as a tested folder-colour label, and names its buttons in sentence
case like the rest of the app.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 11: The calendar on tokens, in the stage colours

`ContentCalendar` keeps a private `STATUS_COLORS` table that paints To Post red, and 37 raw colours.

**Files:**
- Modify: `src/components/ContentCalendar.tsx` (whole file)
- Create: `src/components/ContentCalendar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ContentCalendar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentCalendar from './ContentCalendar';
import { ContentItem } from '../types';

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'to-post', createdAt: 1,
    uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

// Built from local parts, so "the 12th of this month" is the same day in
// every time zone the suite runs in.
const now = new Date();
const thisMonth = (day: number) => new Date(now.getFullYear(), now.getMonth(), day, 10).getTime();
const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

describe('ContentCalendar', () => {
  it("puts a scheduled post on its day in its stage's colour, and opens it", async () => {
    const onItemClick = vi.fn();
    const post = item({ id: 'a', title: 'Laptop deals story', scheduledAt: thisMonth(12) });
    render(
      <ContentCalendar content={[post]} canAdd={false} onDayClick={vi.fn()} onItemClick={onItemClick} />
    );
    const chip = screen.getByRole('button', { name: 'Laptop deals story' });
    expect(chip.style.getPropertyValue('--sc-tint')).toBe('#faefcc');
    await userEvent.click(chip);
    expect(onItemClick).toHaveBeenCalledWith(post);
  });

  it('names its month buttons and moves between months', async () => {
    render(<ContentCalendar content={[]} canAdd={false} onDayClick={vi.fn()} onItemClick={vi.fn()} />);
    expect(screen.getByText(monthLabel(now))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(
      screen.getByText(monthLabel(new Date(now.getFullYear(), now.getMonth() + 1, 1)))
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText(monthLabel(now))).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/ContentCalendar.test.tsx`
Expected: FAIL. The chip has no `--sc-tint`, and the month buttons have no names.

- [ ] **Step 3: Replace `src/components/ContentCalendar.tsx`**

```tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ContentItem } from '../types';
import { stageCardFill, stageCardText, stageCardVars } from '../stageColors';
import { btnIcon, faintText, heading } from '../ui';

interface Props {
  content: ContentItem[];
  canAdd: boolean;
  onDayClick: (date: Date) => void;
  onItemClick: (item: ContentItem) => void;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ContentCalendar({ content, canAdd, onDayClick, onItemClick }: Props) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  const scheduledItems = content.filter((item) => item.scheduledAt && item.scheduledAt > 0);

  function itemsForDay(day: number): ContentItem[] {
    const d = new Date(year, month, day);
    return scheduledItems.filter((item) => isSameDay(new Date(item.scheduledAt!), d));
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isToday = (day: number) => isSameDay(new Date(year, month, day), today);

  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className={btnIcon} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className={`${heading} text-sm`}>{monthLabel}</span>
        <button onClick={nextMonth} className={btnIcon} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className={`text-center text-[10px] font-semibold py-1 uppercase tracking-wider ${faintText}`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;
          const dayItems = itemsForDay(day);
          const todayCell = isToday(day);
          const d = new Date(year, month, day);

          return (
            <div
              key={day}
              onClick={() => canAdd && onDayClick(d)}
              className={`group min-h-[80px] rounded-tile p-1.5 flex flex-col gap-1 border transition-colors duration-100 ${
                todayCell
                  ? 'border-brand/40 bg-brand-soft dark:bg-brand-softdark'
                  : 'border-hairline dark:border-hairline-dark bg-canvas dark:bg-canvas-dark hover:bg-tint dark:hover:bg-tint-dark'
              } ${canAdd ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[11px] font-semibold leading-none ${todayCell ? 'text-brand' : faintText}`}
                >
                  {day}
                </span>
                {canAdd && (
                  <Plus
                    size={10}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${faintText}`}
                  />
                )}
              </div>

              {/* Each post in its stage's card colours, as on the board: To Post
                  used to be red here and amber everywhere else. */}
              {dayItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                  className={`w-full text-left px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium truncate transition-opacity hover:opacity-80 ${stageCardFill} ${stageCardText}`}
                  style={stageCardVars(item.status)}
                  title={item.title}
                >
                  {item.title}
                </button>
              ))}
              {dayItems.length > 3 && (
                <span className={`text-[10px] px-1 ${faintText}`}>+{dayItems.length - 3} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/ContentCalendar.test.tsx src/pages/ClientWorkspacePage.test.tsx`
Expected: PASS. Then run `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ContentCalendar.tsx src/components/ContentCalendar.test.tsx
git commit -q -F - <<'MSG'
Colour the calendar's posts by stage, like the board

The calendar kept its own colour table, in which To Post was red, plus 37
raw colours. Posts now take their stage's card colours, the grid uses the
tokens, and the month buttons are named for screen readers.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 12: The public review page on tokens

**Files:**
- Modify: `src/pages/PublicReviewPage.tsx` (whole file)
- Create: `src/pages/PublicReviewPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/PublicReviewPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicReviewPage from './PublicReviewPage';
import { Share } from '../types';

const share = vi.hoisted(() => ({
  value: null as unknown,
  submitDecision: vi.fn(),
}));

vi.mock('../store', () => ({
  useShare: () => ({ share: share.value, state: 'ready', submitDecision: share.submitDecision }),
}));

function make(over: Partial<Share> = {}): Share {
  return {
    id: 'tok', clientId: 'c', contentId: 'i', clientName: 'Momoland', title: 'Momo reel',
    mediaLink: 'https://drive.google.com/file/d/abc/view', caption: 'Fresh momos', hashtags: '#momo',
    createdAt: 1, createdByEmail: 'a@b.c', revoked: false, ...over,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/review/tok']}>
      <Routes>
        <Route path="/review/:token" element={<PublicReviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicReviewPage', () => {
  beforeEach(() => {
    share.submitDecision.mockReset();
    share.submitDecision.mockResolvedValue(undefined);
  });

  it('shows the post and both decisions', () => {
    share.value = make();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Momo reel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request changes/ })).toBeInTheDocument();
  });

  it('sends a change request with its note', async () => {
    share.value = make();
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Request changes/ }));
    await userEvent.type(screen.getByPlaceholderText('What needs changing?'), 'Brighter thumbnail');
    await userEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(share.submitDecision).toHaveBeenCalledWith('declined', 'Brighter thumbnail');
  });

  it('words a decline as a change request once it is decided', () => {
    share.value = make({ decision: 'declined', decisionNote: 'Brighter thumbnail' });
    renderPage();
    expect(screen.getByText('Changes requested')).toBeInTheDocument();
    expect(screen.getByText('Brighter thumbnail')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/pages/PublicReviewPage.test.tsx`
Expected: FAIL in the last test only. Today the outcome reads "declined" in lower case and is capitalised by CSS, not "Changes requested".

- [ ] **Step 3: Replace `src/pages/PublicReviewPage.tsx`**

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, ExternalLink, Download, Film, Image as ImageIcon } from 'lucide-react';
import { useShare } from '../store';
import { getMediaInfo, runWrite } from '../utils';
import Logo from '../components/Logo';
import { card, heading, bodyText, faintText, readout, textarea, btnGhost, btnPrimary } from '../ui';

// The one page a reviewer outside the app acts on, so approving is a solid
// button. Emerald 700, not 600: white on 600 measures 3.8:1 and fails AA.
const approveBtn =
  'flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

export default function PublicReviewPage() {
  const { token } = useParams<{ token: string }>();
  const { share, state, submitDecision } = useShare(token);
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function decide(decision: 'approved' | 'declined') {
    setSubmitting(true);
    await runWrite(() => submitDecision(decision, note.trim()), 'send your decision');
    setSubmitting(false);
    setDeclining(false);
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen min-h-dvh bg-tint dark:bg-canvas-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );

  if (state === 'loading') {
    return shell(
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  // Covers a wrong token, a deleted item and a revoked link alike — deliberately
  // indistinguishable, so a stale link reveals nothing about what it pointed to.
  if (state === 'missing' || !share || share.revoked) {
    return shell(
      <div className={`${card} p-8 text-center`}>
        <h1 className={`${heading} text-base mb-2`}>This link isn't available</h1>
        <p className={`text-sm leading-relaxed ${faintText}`}>
          It may have expired or been turned off. Ask whoever sent it for a new one.
        </p>
      </div>
    );
  }

  const media = getMediaInfo(share.mediaLink);
  const isGraphic = share.mediaType === 'graphic';
  const decided = share.decision === 'approved' || share.decision === 'declined';
  const approved = share.decision === 'approved';

  return shell(
    <>
      <div className="flex items-center gap-2.5 mb-5">
        <Logo variant="full" size={40} />
        <div>
          <span className={`${heading} text-[15px]`}>Limi</span>
          <p className={`text-[11px] ${faintText}`}>{share.clientName}</p>
        </div>
      </div>

      <div className={`${card} overflow-hidden shadow-lift`}>
        <div className="bg-tint dark:bg-tint-dark" style={{ aspectRatio: '16/9' }}>
          {media.previewUrl && !imgError ? (
            <img
              src={media.previewUrl}
              alt={share.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              {isGraphic ? (
                <ImageIcon size={24} className={faintText} />
              ) : (
                <Film size={24} className={faintText} />
              )}
              <span className={`text-[11px] px-6 text-center ${faintText}`}>
                {media.previewNote ?? 'No preview available — open the link below.'}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <h1 className={`${heading} text-base leading-snug`}>{share.title}</h1>

          {share.caption && <p className={readout}>{share.caption}</p>}

          {share.hashtags && (
            <p className={`text-xs leading-relaxed break-words ${faintText}`}>{share.hashtags}</p>
          )}

          <div className="flex items-center gap-2">
            <a
              href={share.mediaLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnGhost} flex-1`}
            >
              <ExternalLink size={13} />
              Open
            </a>
            {isGraphic && media.downloadUrl && (
              <a
                href={media.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnGhost} flex-1`}
              >
                <Download size={13} />
                Download
              </a>
            )}
          </div>

          <div className="pt-4 border-t border-hairline dark:border-hairline-dark">
            {decided ? (
              <div
                className={`flex items-center gap-2 rounded-tile p-3.5 ${
                  approved
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-brand-soft dark:bg-brand-softdark text-brand dark:text-red-400'
                }`}
              >
                {approved ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <div>
                  <p className="text-sm font-semibold">{approved ? 'Approved' : 'Changes requested'}</p>
                  {share.decisionNote && (
                    <p className={`text-xs mt-0.5 ${bodyText}`}>{share.decisionNote}</p>
                  )}
                </div>
              </div>
            ) : declining ? (
              <div className="flex flex-col gap-2.5">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What needs changing?"
                  aria-label="What needs changing?"
                  rows={3}
                  className={textarea}
                />
                <div className="flex gap-2">
                  <button onClick={() => setDeclining(false)} className={`${btnGhost} flex-1`}>
                    Back
                  </button>
                  <button
                    onClick={() => decide('declined')}
                    disabled={submitting}
                    className={`${btnPrimary} flex-1`}
                  >
                    {submitting ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setDeclining(true)}
                  className={`${btnGhost} flex-1 hover:!text-brand hover:!border-brand/40`}
                >
                  <XCircle size={14} />
                  Request changes
                </button>
                <button onClick={() => decide('approved')} disabled={submitting} className={approveBtn}>
                  <CheckCircle size={14} />
                  {submitting ? 'Sending…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className={`text-center text-xs mt-5 ${faintText}`}>Shared with you for review</p>
    </>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/PublicReviewPage.test.tsx`
Expected: PASS. Then run `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PublicReviewPage.tsx src/pages/PublicReviewPage.test.tsx
git commit -q -F - <<'MSG'
Move the public review page onto the design tokens

The page a reviewer outside the app sees still wore the retired near-black
look in 83 raw colours. It now uses the shared card, prose and button
recipes; its approve button moves to a shade white text can be read on;
and a decline reads as "Changes requested", as it does to the reviewer
who sent it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 13: Setup screen, splash, notification banner and dashboard on tokens

**Files:**
- Modify: `src/App.tsx` (`FirebaseSetupGuide`, `AuthSplash`, imports)
- Modify: `src/components/NotifPermissionBanner.tsx` (the two returned blocks, imports)
- Modify: `src/components/Dashboard.tsx` (whole file)
- Create: `src/components/Dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/Dashboard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { Client, ContentItem } from '../types';

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing', createdAt: 1,
    uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

const clients: Client[] = [{
  id: 'a', name: 'Momoland', about: '', businesses: [], createdAt: 1,
  content: [item({ id: '1', status: 'review' }), item({ id: '2', status: 'posted' })],
}];

describe('Dashboard', () => {
  it("breaks the pipeline down under the board's own stage names", () => {
    render(<Dashboard clients={clients} role="admin" />);
    for (const name of ['Editing', 'Review', 'To Post', 'Posted']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('gives a client their own three numbers', () => {
    render(<Dashboard clients={clients} role="client" />);
    expect(screen.getByText('Needs your review')).toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/Dashboard.test.tsx`
Expected: FAIL in the first test. The dashboard's private stage list says "In Review" and "Ready to Post", not the board's "Review" and "To Post".

- [ ] **Step 3: Replace `src/components/Dashboard.tsx`**

```tsx
import { Client, ContentItem, ContentStatus, UserRole } from '../types';
import { STAGES } from '../utils';
import { stageCardVars, stageDot } from '../stageColors';
import { tile, heading, faintText, bodyText } from '../ui';

const DAY = 86_400_000;

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// The dot beside a number names the stage it counts, in that stage's colour.
// An overdue count is the one red thing on the page.
type Accent = ContentStatus | 'overdue';

function AccentDot({ accent }: { accent: Accent }) {
  if (accent === 'overdue') return <span className="w-1.5 h-1.5 rounded-full bg-brand" />;
  return <span className={`w-1.5 h-1.5 rounded-full ${stageDot}`} style={stageCardVars(accent)} />;
}

// A headline number is a stat tile, not a chart — there is no shape to read.
function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: Accent;
}) {
  return (
    <div className={`${tile} p-4 sm:p-5`}>
      <div className="flex items-center gap-2">
        {accent && <AccentDot accent={accent} />}
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${faintText}`}>
          {label}
        </span>
      </div>
      <p className={`${heading} text-2xl sm:text-3xl mt-2 tabular-nums`}>{value}</p>
      {hint && <p className={`text-xs mt-1 ${faintText}`}>{hint}</p>}
    </div>
  );
}

// Single series, magnitude by category → horizontal bars. One hue, sorted
// descending, values labelled directly so the bar length is never the only cue.
function VolumeBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="group">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className={`text-xs truncate ${bodyText}`} title={r.label}>
              {r.label}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${heading}`}>{r.value}</span>
          </div>
          <div className="h-2 rounded-full bg-hairline dark:bg-hairline-dark overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${(r.value / max) * 100}%` }}
              title={`${r.label}: ${r.value}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// The board's own stages, names and colours, rather than a private copy that
// had drifted to "In Review" and "Ready to Post".
function StageBreakdown({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {STAGES.map((s) => {
        const count = items.filter((i) => i.status === s.id).length;
        return (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className={`h-1.5 rounded-full ${stageDot}`} style={stageCardVars(s.id)} />
            <span className={`text-lg font-semibold tabular-nums ${heading}`}>{count}</span>
            {/* Label always present — colour never carries meaning alone. */}
            <span className={`text-[11px] ${faintText}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ clients, role }: { clients: Client[]; role: UserRole }) {
  const all = clients.flatMap((c) => c.content);
  const now = Date.now();
  const monthStart = startOfMonth();

  const postedThisMonth = all.filter(
    (i) => i.status === 'posted' && (i.scheduledAt || i.createdAt) >= monthStart
  ).length;
  const awaitingReview = all.filter((i) => i.status === 'review').length;
  const readyToPost = all.filter((i) => i.status === 'to-post').length;

  const decided = all.filter((i) => i.clientReview === 'approved' || i.clientReview === 'declined');
  const declined = decided.filter((i) => i.clientReview === 'declined').length;
  const declineRate = decided.length ? Math.round((declined / decided.length) * 100) : 0;

  const dueThisWeek = all.filter(
    (i) => i.scheduledAt && i.scheduledAt >= now && i.scheduledAt <= now + 7 * DAY
  ).length;
  const overdue = all.filter(
    (i) => i.scheduledAt && i.scheduledAt > 0 && i.scheduledAt < now && i.status !== 'posted'
  ).length;

  const volume = clients
    .map((c) => ({ label: c.name, value: c.content.length }))
    .sort((a, b) => b.value - a.value)
    .filter((r) => r.value > 0);

  if (role === 'client') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Posted this month" value={postedThisMonth} accent="posted" />
        <Stat
          label="Needs your review"
          value={awaitingReview}
          hint={awaitingReview ? 'Waiting on you' : 'Nothing pending'}
          accent="review"
        />
        <Stat label="Scheduled next 7 days" value={dueThisWeek} accent="to-post" />
      </div>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Posted this month" value={postedThisMonth} accent="posted" />
        <Stat
          label="Awaiting client"
          value={awaitingReview}
          hint={awaitingReview ? 'Chase if stale' : 'All clear'}
          accent="review"
        />
        <Stat label="Due in 7 days" value={dueThisWeek} accent="to-post" />
        <Stat
          label="Overdue"
          value={overdue}
          hint={overdue ? 'Past scheduled date' : 'Nothing late'}
          accent={overdue ? 'overdue' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className={`${tile} p-4 sm:p-5 lg:col-span-2`}>
          <h3 className={`text-sm ${heading} mb-4`}>Content per client</h3>
          {volume.length === 0 ? (
            <p className={`text-xs ${faintText}`}>Nothing to show yet.</p>
          ) : (
            <VolumeBars rows={volume} />
          )}
        </div>

        <div className={`${tile} p-4 sm:p-5 flex flex-col gap-4`}>
          <div>
            <h3 className={`text-sm ${heading} mb-3`}>Pipeline</h3>
            <StageBreakdown items={all} />
          </div>
          {isAdmin && (
            <div className="pt-3 border-t border-hairline dark:border-hairline-dark">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${faintText}`}>
                Client decline rate
              </span>
              <p className={`${heading} text-2xl mt-1.5 tabular-nums`}>{declineRate}%</p>
              <p className={`text-xs mt-0.5 ${faintText}`}>
                {decided.length ? `${declined} of ${decided.length} reviewed` : 'No decisions yet'}
              </p>
            </div>
          )}
          {!isAdmin && (
            <div className="pt-3 border-t border-hairline dark:border-hairline-dark">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${faintText}`}>
                Ready to post
              </span>
              <p className={`${heading} text-2xl mt-1.5 tabular-nums`}>{readyToPost}</p>
              <p className={`text-xs mt-0.5 ${faintText}`}>Approved and queued</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Move the notification banner onto tokens**

In `src/components/NotifPermissionBanner.tsx`:

1. Add `import { card, heading, faintText, btnIcon } from '../ui';`.
2. Below `const DISMISSED_KEY = …`, add:

```tsx
// btnPrimary's 44px minimum cannot be overridden by a smaller height (Tailwind,
// not the class list, orders the two), so the banner's compact button is its own.
const enableBtn =
  'inline-flex items-center h-8 px-3 rounded-tile bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';
```

3. Replace the `justEnabled` block's returned JSX with:

```tsx
      <div
        role="status"
        className="mb-5 rounded-card border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex items-center gap-3"
      >
        <div className="w-7 h-7 rounded-tile bg-white dark:bg-emerald-950/60 flex items-center justify-center flex-shrink-0">
          <Check size={14} className="text-emerald-700 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          Reminders enabled — you'll be notified when it's time to post.
        </p>
      </div>
```

4. Replace the final returned JSX with:

```tsx
    <div className={`${card} mb-5 !border-brand/25 px-4 py-3.5 flex items-center gap-3`}>
      <div className="w-8 h-8 rounded-tile bg-brand-soft dark:bg-brand-softdark flex items-center justify-center flex-shrink-0">
        <Bell size={15} className="text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`${heading} text-sm leading-tight`}>Enable post reminders</p>
        <p className={`text-xs mt-0.5 leading-relaxed ${faintText}`}>
          Get notified on this device when scheduled content is due to post.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={handleEnable} disabled={enabling} className={enableBtn}>
          {enabling ? 'Enabling…' : 'Enable'}
        </button>
        <button onClick={handleDismiss} className={btnIcon} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
```

- [ ] **Step 5: Move the setup screen and splash onto tokens**

In `src/App.tsx`, add `import { page, card, heading, bodyText, faintText, inset } from './ui';` and replace `FirebaseSetupGuide` and `AuthSplash` with:

```tsx
const codeInline = 'bg-tint dark:bg-tint-dark px-1 rounded-[4px] text-ink-soft dark:text-ink-softdark';

function FirebaseSetupGuide() {
  return (
    <div className={`${page} flex items-center justify-center p-4`}>
      <div className={`${card} max-w-md w-full p-6`}>
        <div className="flex items-center gap-2.5 mb-5">
          <Logo variant="mark" size={32} />
          <span className={`${heading} text-base`}>Limi · Setup required</span>
        </div>
        <p className={`text-sm mb-5 leading-relaxed ${bodyText}`}>
          Firebase is not configured yet. Complete these steps to connect your database:
        </p>
        <ol className={`text-sm space-y-2 mb-5 ${bodyText}`}>
          <li className="flex gap-2"><span className="text-brand font-bold">1.</span>Create a project at <span className="text-ink dark:text-ink-dark">console.firebase.google.com</span></li>
          <li className="flex gap-2"><span className="text-brand font-bold">2.</span><span>Enable <strong className="text-ink dark:text-ink-dark">Firestore Database</strong> (start in test mode)</span></li>
          <li className="flex gap-2"><span className="text-brand font-bold">3.</span>Go to Project Settings → Your apps → Web</li>
          <li className="flex gap-2"><span className="text-brand font-bold">4.</span>Copy your config and create a <code className={codeInline}>.env</code> file:</li>
        </ol>
        <pre className={`${inset} p-4 text-xs leading-relaxed overflow-x-auto ${bodyText}`}>
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`}
        </pre>
        <p className={`text-xs mt-4 ${faintText}`}>
          Then restart the dev server with <code className={codeInline}>npm run dev</code>
        </p>
      </div>
    </div>
  );
}

function AuthSplash() {
  return (
    <div className={`${page} flex items-center justify-center`}>
      <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
    </div>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: all pass, including `Dashboard.test.tsx`. Then run `npx tsc --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/NotifPermissionBanner.tsx src/components/Dashboard.tsx src/components/Dashboard.test.tsx
git commit -q -F - <<'MSG'
Move the setup screen, splash, reminder banner and dashboard onto tokens

The last screens still drawn in raw colours now use the shared recipes.
The dashboard's pipeline takes the board's own stage names and colours
instead of a private copy that had drifted to "In Review" and "Ready to
Post".

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 14: A guard against raw colours

**Files:**
- Create: `src/noRawColours.test.ts`

- [ ] **Step 1: Write the guard**

Create `src/noRawColours.test.ts`:

```ts
// Every colour in a component comes from a token file: tailwind.config.js,
// src/ui.ts, STAGES in src/utils.ts, src/folderColors.ts, src/stageColors.ts.
// A literal in a component is how the old UI drifted into 290 of them, so this
// fails on one. Test files may hold literals: they assert the palettes.
const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// A 3-, 6- or 8-digit hex colour not preceded by `&` or a word character (so
// `&#8203;` is not a colour), or one of the retired neutral-* utilities.
const RAW = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|\bneutral-\d{2,3}\b/g;

const components = Object.entries(sources).filter(([path]) => !path.endsWith('.test.tsx'));

describe('components use tokens, not raw colours', () => {
  it('finds the components', () => {
    expect(components.length).toBeGreaterThan(40);
  });

  it.each(components)('%s has no raw colour', (_path, source) => {
    expect(source.match(RAW) ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/noRawColours.test.ts`
Expected: PASS. If a file fails, the failure lists the literals. Replace each with the token for the same role:

| Raw colour | Token |
| --- | --- |
| text greys | `text-ink` / `text-ink-soft` / `text-ink-faint` (with `dark:` pairs) |
| surfaces | `bg-canvas` / `bg-tint` |
| lines | `border-hairline` |
| red | `brand` |
| stage colours | `stageCardVars` and the stage classes |

Re-run until it passes, and commit any such fixes with this task.

- [ ] **Step 3: Run everything**

Run: `npm test`, then `npx tsc --noEmit`.
Expected: all pass, and tsc prints nothing.

- [ ] **Step 4: Commit**

```bash
git add src/noRawColours.test.ts
git commit -q -F - <<'MSG'
Fail the build on a raw colour in a component

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
```

---

### Task 15: Look at it in a browser (controller)

The controller does this task, not a subagent. It needs the browser pane, and judgement about what looks right.

**Files:**
- Create (gitignored): `.superpowers/visual-harness/index.html`
- Create (gitignored): `.superpowers/visual-harness/main.tsx`

- [ ] **Step 1: Build the harness**

`.superpowers/visual-harness/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Limi visual harness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`.superpowers/visual-harness/main.tsx` renders the following from fixture data, with no Firebase anywhere in the import chain:

- the team `ContentBoard`, in a 600px-tall box;
- a grid of `ClientFolder` tiles in six colours, one with a logo URL and one without content;
- `FolderIcon` at 14, 18, 40 and 88px;
- a button that toggles the theme through `useTheme().toggleTheme`.

Its `onMove` updates local state after 300ms, the way Firestore lands a move after the drop. The harness's own layout uses inline styles: Tailwind does not scan `.superpowers/`, so a class used only there would not exist.

```tsx
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../src/index.css';
import { ThemeProvider, useTheme } from '../../src/contexts/ThemeContext';
import ContentBoard from '../../src/components/workspace/ContentBoard';
import ClientFolder from '../../src/components/ClientFolder';
import FolderIcon from '../../src/components/FolderIcon';
import { Campaign, Client, ContentItem, ContentStatus, FolderColor } from '../../src/types';

const day = (n: number) => Date.now() + n * 86_400_000;

function item(id: string, title: string, status: ContentStatus, over: Partial<ContentItem> = {}): ContentItem {
  return {
    id, title, status, driveLink: '', driveFileId: '', createdAt: Number(id.slice(1)),
    uploadedByEmail: 'team@limi.test', clientReview: 'pending', ...over,
  };
}

const CAMPAIGN: Campaign = {
  id: 'c1', businessId: 'main', name: 'Dashain sale', brief: '', status: 'live', color: 'orange',
  deliverables: [], createdAt: 1,
};

const START: ContentItem[] = [
  item('i1', 'Dashain promo reel', 'editing', { campaignId: 'c1' }),
  item('i2', 'Store tour cut 2', 'editing', { scheduledAt: day(5) }),
  item('i3', 'Momo platter carousel', 'review', { campaignId: 'c1', scheduledAt: day(3), platforms: ['instagram'] }),
  item('i4', 'Founder story', 'review', { clientReview: 'declined' }),
  item('i5', 'Laptop deals story', 'to-post', { clientReview: 'approved', scheduledAt: day(-1) }),
  item('i6', 'Tihar giveaway', 'posted', { platforms: ['instagram', 'facebook'] }),
];

function client(id: string, name: string, color: FolderColor, content: ContentItem[], imageUrl?: string): Client {
  return { id, name, color, content, imageUrl, about: '', businesses: [], createdAt: 1 };
}

const CLIENTS: Client[] = [
  client('a', 'Shopit Nepal', 'blue', START),
  client('b', 'Momoland', 'orange', [item('m1', 'x', 'posted')]),
  client('c', 'Chiya Bandhu', 'green', [], 'https://www.google.com/favicon.ico'),
  client('d', 'Everest IT', 'purple', [item('e1', 'x', 'review')]),
  client('e', 'Times Computer Solutions', 'graphite', [item('t1', 'x', 'editing')]),
  client('f', 'Mortgage Superheroes', 'pink', []),
];

function Harness() {
  const { theme, toggleTheme } = useTheme();
  const [content, setContent] = useState(START);
  const move = (target: ContentItem, status: ContentStatus) =>
    setTimeout(() => setContent((all) => all.map((i) => (i.id === target.id ? { ...i, status } : i))), 300);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <button onClick={toggleTheme} style={{ alignSelf: 'flex-start' }}>Theme: {theme}</button>
      <div style={{ height: 600, display: 'flex', flexDirection: 'column', border: '1px dashed gray' }}>
        <ContentBoard
          content={content}
          campaigns={[CAMPAIGN]}
          businesses={[]}
          isClientRole={false}
          canAdd
          canEditItem={() => true}
          canDeleteItem={() => true}
          campaignFilter
          onOpen={() => {}}
          onAdd={() => {}}
          onEdit={() => {}}
          onMove={move}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 16 }}>
        {CLIENTS.map((c) => <ClientFolder key={c.id} client={c} onEdit={() => {}} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 16 }}>
        {[14, 18, 40, 88].map((s) => <FolderIcon key={s} size={s} color="teal" label="Teal" />)}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </ThemeProvider>
  </StrictMode>
);
```

- [ ] **Step 2: Open it**

1. Start the `limi-dev` launch configuration with `preview_start`.
2. Navigate to `/.superpowers/visual-harness/index.html`.
3. First check that the pane is drawing: evaluate `await Promise.race([new Promise(r => requestAnimationFrame(() => r('ok'))), new Promise(r => setTimeout(() => r('paused'), 1000))])`. If it reports `paused`, see the `limi-browser-verification` memory before trusting any animation or focus result.

- [ ] **Step 3: Check, in light and then dark**

- [ ] Each card is in its stage's pastel.
- [ ] Titles are dark, and the chips read clearly.
- [ ] The overdue date chip is red.
- [ ] Columns have no grey box.
- [ ] Hovering a card lifts it with a soft shadow.
- [ ] Drag a card with the keyboard (focus it, Space, ArrowRight, Space). The overlay tilts, the source fades, the card settles, and it lands in the next column 300ms later.
- [ ] Folders are in the right colours, and the 88px ones show the initial or the logo.
- [ ] The Chiya Bandhu logo shows, or falls back to "C" if blocked.
- [ ] Hovering a folder tile lifts the folder and dips its front.
- [ ] Dark mode: the deep tints, light titles and folders all still read.

Take a screenshot of each theme as evidence. Fix anything wrong in the component, not the harness, with its own commit, and re-run `npm test`.

---

### Task 16: Final checks and push (controller)

- [ ] **Step 1: Run the whole suite, types and build**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`.
Expected:
- every test passes, and the count is at least 265 plus the new tests;
- tsc prints nothing;
- the build succeeds.

- [ ] **Step 2: Confirm nothing raw is left and nothing dangles**

Run: `grep -rn "ClientAvatar\|ClientCard" src`
Expected: no output.

- [ ] **Step 3: Push**

Run: `git push origin claude/gifted-goldberg-3yf5wj`
Expected: the branch moves. Vercel builds a preview from it; production is promoted by hand and is not touched.
