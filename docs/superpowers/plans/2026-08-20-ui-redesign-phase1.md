# UI Redesign Phase 1 — Foundation and Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's navigation with a persistent Notion-register sidebar, repoint the design tokens to a contrast-validated light-first palette, and default the theme to light — leaving the app fully working and visually coherent on the pages a user opens first.

**Architecture:** Token values in `tailwind.config.js` are repointed in place while keeping their existing names, so the seven already-tokenised components adopt the new look with no edits and cannot silently break. Navigation moves into a new presentational `Sidebar` fed by a pure `buildNav()` model, wrapped by an `AppShell` that owns the sidebar/drawer/breadcrumb layout for every authenticated route. A new `color.ts` makes the palette's accessibility claims executable as tests rather than comments.

**Tech Stack:** React 18, TypeScript, Tailwind (class dark mode), react-router-dom 6, Vitest + jsdom + Testing Library (added by this plan), lucide-react.

Spec: `docs/superpowers/specs/2026-08-20-ui-redesign-design.md`

Phases 2–4 (board and table views, Today, command palette, modals, remaining pages) get their own plans.

---

## File Structure

**Created**
- `src/color.ts` — pure WCAG luminance/contrast maths. No React, no imports.
- `src/color.test.ts` — asserts the palette in `tailwind.config.js` and the stage pairs in `utils.ts` actually meet 4.5:1.
- `src/nav.ts` — pure navigation model: which clients a user sees, how many items await each client's review, whether Team shows.
- `src/nav.test.ts`
- `src/components/Sidebar.tsx` — presentational nav tree. Takes a `NavModel` and callbacks; holds no data logic.
- `src/components/Sidebar.test.tsx`
- `src/components/AppShell.tsx` — sidebar + drawer + breadcrumb bar layout wrapper.
- `src/test/setup.ts` — Testing Library matchers.

**Modified**
- `tailwind.config.js` — palette repointed, radii shrunk, `shadow-card` flattened.
- `src/utils.ts` — `STAGES` gains validated tint/text pairs for both themes.
- `src/ui.ts` — rewritten as the full vocabulary; new sidebar/nav/breadcrumb entries.
- `src/contexts/ThemeContext.tsx` — default light.
- `src/App.tsx` — authenticated routes wrapped in `AppShell`; `BottomNav` removed.
- `src/pages/ClientsPage.tsx` — local `Header` deleted (the shell owns it); 14 hardcoded colours removed.
- `src/components/ClientCard.tsx` — 15 hardcoded colours removed.
- `vite.config.ts`, `tsconfig.json`, `package.json` — test wiring.

**Deleted**
- `src/components/BottomNav.tsx` — the sidebar drawer replaces it.

---

### Task 1: Test infrastructure

There is currently no test framework in this repo. Phase 1 introduces pure logic (`color.ts`, `nav.ts`) worth locking down, so set up Vitest first.

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest@^1.6.0 jsdom@^24.0.0 @testing-library/react@^15.0.0 @testing-library/jest-dom@^6.4.0 @testing-library/user-event@^14.5.2
```

- [ ] **Step 2: Add the test scripts**

In `package.json`, inside `"scripts"`, add these two entries alongside the existing `dev`/`build`/`preview`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create the Testing Library setup file**

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Wire Vitest into the Vite config**

`vite.config.ts` currently reads:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Honour PORT so a harness that assigns a free port gets the server it asked
  // for, instead of Vite silently walking to the next one.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
})
```

Replace the whole file with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Honour PORT so a harness that assigns a free port gets the server it asked
  // for, instead of Vite silently walking to the next one.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // The harness files under .superpowers are mockups, not tests.
    exclude: ['node_modules', 'dist', '.superpowers'],
  },
})
```

- [ ] **Step 5: Teach TypeScript about the globals**

In `tsconfig.json`, the `"types"` array currently reads `["vite/client"]`. Change it to:

```json
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
```

- [ ] **Step 6: Verify the runner starts with no tests**

Run: `npm run test`
Expected: exits reporting "No test files found" (exit code 1 is fine here — Task 2 adds the first test).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json src/test/setup.ts
git commit -m "Add Vitest so the palette's accessibility claims can be tested"
```

---

### Task 2: `color.ts` — make the contrast claims executable

The spec records contrast ratios that were computed by hand. Encode the maths so a future palette edit that breaks accessibility fails the build instead of shipping.

**Files:**
- Create: `src/color.ts`
- Test: `src/color.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/color.test.ts`:

```ts
import { contrastRatio, relativeLuminance } from './color';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('accepts values with or without the leading hash', () => {
    expect(relativeLuminance('fff')).toBeCloseTo(relativeLuminance('#ffffff'), 5);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is 1 for a colour against itself', () => {
    expect(contrastRatio('#37352f', '#37352f')).toBeCloseTo(1, 5);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio('#37352f', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#37352f'),
      5
    );
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test -- src/color.test.ts`
Expected: FAIL — `Failed to resolve import "./color"`.

- [ ] **Step 3: Implement `color.ts`**

Create `src/color.ts`:

```ts
// WCAG 2.1 relative luminance and contrast. Kept dependency-free and pure so
// the palette's accessibility claims can be asserted in tests rather than
// written down in a comment and quietly drifting.

function channels(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function linearise(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio between 1 and 21. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm run test -- src/color.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/color.ts src/color.test.ts
git commit -m "Add WCAG contrast maths as a testable unit"
```

---

### Task 3: Repoint the palette

Keep every existing token **name** and change its **value**. This is what lets the seven already-tokenised components (`ContentDetailModal`, `AddContentModal`, `AddClientModal`, `CommentThread`, `Dashboard`, `LoginPage`, `UserManagementPage`) adopt the new look with zero edits — and it means a missed migration degrades gracefully instead of emitting a class Tailwind never generated.

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace the `theme.extend` block**

In `tailwind.config.js`, replace everything from `colors: {` through the closing `},` of `boxShadow` with:

```js
      colors: {
        // Notion register: pure white page, warm near-black ink, a single
        // off-white tint for sidebar and insets. Every text tier below clears
        // WCAG AA (4.5:1) on both `canvas` and `tint`, in both themes — see
        // src/color.test.ts, which asserts it.
        canvas: { DEFAULT: '#ffffff', dark: '#191919' },
        // `surface` is the same as canvas in this register: cards are defined
        // by a hairline, not by being a different colour. The name is kept so
        // existing components need no edit.
        surface: { DEFAULT: '#ffffff', dark: '#191919' },
        // Sidebar, insets, read-only prose blocks. `raised` is an alias kept
        // for the same reason as `surface`.
        tint: { DEFAULT: '#f7f7f5', dark: '#252525' },
        raised: { DEFAULT: '#f7f7f5', dark: '#252525' },
        hover: { DEFAULT: '#efefed', dark: '#2f2f2f' },
        hairline: { DEFAULT: '#eae9e5', dark: '#333333' },
        ink: {
          DEFAULT: '#37352f',
          soft: '#5c5b56',
          faint: '#71706b',
          dark: '#e9e9e7',
          softdark: '#a8a8a4',
          faintdark: '#8c8c88',
        },
        brand: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
          soft: '#fdf2f2',
          softdark: '#2a1414',
        },
        // Stage text colours. The tint/text pairs used by the pills live in
        // STAGES in src/utils.ts, because they are applied as inline styles.
        stage: {
          editing: '#6940a5',
          review: '#0b6e99',
          post: '#8a6100',
          posted: '#2f6e4a',
        },
      },
      borderRadius: {
        // Notion geometry: 4px for controls and cards, 6px for floating layers.
        // Replaces the previous 14/18px, which read as consumer-app rather than
        // document-tool.
        card: '6px',
        tile: '4px',
      },
      boxShadow: {
        // Static surfaces are defined by a hairline, not a shadow. `shadow-card`
        // is deliberately flattened rather than removed so existing components
        // that reference it become flat instead of losing a class silently.
        card: 'none',
        lift: '0 4px 12px rgba(15,15,15,0.10), 0 1px 3px rgba(15,15,15,0.06)',
        pill: 'none',
      },
```

- [ ] **Step 2: Add the palette assertions to the contrast test**

Append to `src/color.test.ts`:

```ts
// @ts-expect-error -- tailwind.config.js is plain JS with no type declarations
import twConfig from '../tailwind.config.js';

const palette = (twConfig as any).theme.extend.colors;
const AA = 4.5;

describe('palette meets WCAG AA', () => {
  const light = { page: palette.canvas.DEFAULT, tint: palette.tint.DEFAULT };
  const dark = { page: palette.canvas.dark, tint: palette.tint.dark };

  const lightTiers = [palette.ink.DEFAULT, palette.ink.soft, palette.ink.faint];
  const darkTiers = [palette.ink.dark, palette.ink.softdark, palette.ink.faintdark];

  it.each(lightTiers)('light ink tier %s clears AA on page and tint', (tier) => {
    expect(contrastRatio(tier, light.page)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, light.tint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(darkTiers)('dark ink tier %s clears AA on page and tint', (tier) => {
    expect(contrastRatio(tier, dark.page)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, dark.tint)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the three light tiers visibly separated', () => {
    const [ink, soft, faint] = lightTiers.map((c) => contrastRatio(c, light.page));
    expect(ink / soft).toBeGreaterThan(1.3);
    expect(soft / faint).toBeGreaterThan(1.3);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm run test -- src/color.test.ts`
Expected: PASS. Light faint `#71706b` is 4.96 on white and 4.63 on tint; dark faint `#8c8c88` is 5.21 and 4.54. If any assertion fails, the palette is wrong — do not loosen `AA`.

- [ ] **Step 4: Confirm the app still compiles and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed. The app will look half-migrated at this point; that is expected.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/color.test.ts
git commit -m "Repoint the palette to a contrast-validated Notion register"
```

---

### Task 4: Stage pills

`STAGES` currently carries one `color` per stage, used as a saturated dot. Add the validated tint/text pairs the pills need, keeping `color` for the board's accent line and the calendar.

**Files:**
- Modify: `src/utils.ts`
- Test: `src/color.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/color.test.ts`:

```ts
import { STAGES } from './utils';

describe('stage pills meet WCAG AA', () => {
  it('covers all four stages', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['editing', 'review', 'to-post', 'posted']);
  });

  it.each(STAGES)('$label pill is readable in light mode', (stage) => {
    expect(contrastRatio(stage.text, stage.tint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(STAGES)('$label pill is readable in dark mode', (stage) => {
    expect(contrastRatio(stage.textDark, stage.tintDark)).toBeGreaterThanOrEqual(AA);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test -- src/color.test.ts`
Expected: FAIL — `stage.tint` is undefined, so `contrastRatio` throws `Not a hex colour: undefined`.

- [ ] **Step 3: Extend `STAGES`**

In `src/utils.ts`, replace the existing `STAGES` declaration (the `export const STAGES: { id: ContentStatus; label: string; color: string }[] = [...]` block at the end of the file) with:

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
}

// One source of truth so the board, the detail sheet and the activity trail can
// never disagree about a stage's name or colour.
//
// The pill pairs below are asserted against WCAG AA in src/color.test.ts. Note
// that `to-post` text is #8a6100 rather than the more obvious #996c00: that
// measured 4.21 against its tint and failed.
//
// A stage is never signalled by colour alone — the label is always present, and
// the tint only reinforces it. That is what permits the 6-8 colour-vision
// separation band these hues sit in.
export const STAGES: Stage[] = [
  { id: 'editing', label: 'Editing', color: '#6940a5',
    tint: '#f4f0fb', text: '#6940a5', tintDark: '#2b2142', textDark: '#b592f0' },
  { id: 'review', label: 'Review', color: '#0b6e99',
    tint: '#e7f3f8', text: '#0b6e99', tintDark: '#15303d', textDark: '#77bddd' },
  { id: 'to-post', label: 'To Post', color: '#8a6100',
    tint: '#faf3dd', text: '#8a6100', tintDark: '#332711', textDark: '#dfab5f' },
  { id: 'posted', label: 'Posted', color: '#2f6e4a',
    tint: '#eef3ed', text: '#2f6e4a', tintDark: '#1a2e23', textDark: '#71b391' },
];
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm run test -- src/color.test.ts`
Expected: PASS, 9 new assertions.

- [ ] **Step 5: Confirm nothing broke**

Run: `npx tsc --noEmit`
Expected: PASS. `ClientBoardPage` uses `STAGES` as `COLUMNS` and reads only `id`, `label` and `color`, all still present.

- [ ] **Step 6: Commit**

```bash
git add src/utils.ts src/color.test.ts
git commit -m "Add validated stage pill tints, correcting To Post's failing amber"
```

---

### Task 5: `nav.ts` — the navigation model

Pure logic, extracted so the sidebar stays presentational and the role rules are testable.

**Files:**
- Create: `src/nav.ts`
- Test: `src/nav.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/nav.test.ts`:

```ts
import { awaitingReview, buildNav } from './nav';
import { AppUser, Client, ContentItem } from './types';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 't', driveLink: '', driveFileId: '', status: 'review',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(id: string, content: ContentItem[] = []): Client {
  return { id, name: id.toUpperCase(), about: '', content, createdAt: 1 };
}

function user(role: AppUser['role'], assignedClientIds: string[] = []): AppUser {
  return { id: 'u1', name: 'U', email: 'u@x.com', role, assignedClientIds, createdAt: 1 };
}

describe('awaitingReview', () => {
  it('counts only items in review that the client has not decided', () => {
    expect(awaitingReview([
      item(),
      item({ id: 'i2' }),
      item({ id: 'i3', clientReview: 'approved' }),
      item({ id: 'i4', status: 'posted' }),
    ])).toBe(2);
  });

  it('is 0 for an empty board', () => {
    expect(awaitingReview([])).toBe(0);
  });
});

describe('buildNav', () => {
  const clients = [client('acme', [item()]), client('bolt'), client('cine')];

  it('gives an admin every client and the Team entry', () => {
    const nav = buildNav(clients, user('admin'));
    expect(nav.clients.map((c) => c.id)).toEqual(['acme', 'bolt', 'cine']);
    expect(nav.showTeam).toBe(true);
  });

  it('gives a manager every client but no Team entry', () => {
    const nav = buildNav(clients, user('social-media-manager'));
    expect(nav.clients).toHaveLength(3);
    expect(nav.showTeam).toBe(false);
  });

  it('gives a client only their assigned boards', () => {
    const nav = buildNav(clients, user('client', ['bolt']));
    expect(nav.clients.map((c) => c.id)).toEqual(['bolt']);
    expect(nav.showTeam).toBe(false);
  });

  it('carries the attention count per client', () => {
    const nav = buildNav(clients, user('admin'));
    expect(nav.clients.find((c) => c.id === 'acme')!.attention).toBe(1);
    expect(nav.clients.find((c) => c.id === 'bolt')!.attention).toBe(0);
  });

  it('is empty while the user is still resolving', () => {
    expect(buildNav(clients, null)).toEqual({ clients: [], showTeam: false });
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test -- src/nav.test.ts`
Expected: FAIL — `Failed to resolve import "./nav"`.

- [ ] **Step 3: Implement `nav.ts`**

Create `src/nav.ts`:

```ts
import { AppUser, Client, ContentItem } from './types';

export interface NavClient {
  id: string;
  name: string;
  imageUrl?: string;
  /** Items sitting in Review that the client has not yet decided on. */
  attention: number;
}

export interface NavModel {
  clients: NavClient[];
  showTeam: boolean;
}

// "Needs someone else" is the only count worth putting in navigation: it is the
// one number that tells you where to look without opening anything.
export function awaitingReview(content: ContentItem[]): number {
  return content.filter((i) => i.status === 'review' && i.clientReview === 'pending').length;
}

export function buildNav(clients: Client[], user: AppUser | null): NavModel {
  // Auth resolves asynchronously; rendering an empty tree beats flashing every
  // client at a user whose role has not arrived yet.
  if (!user) return { clients: [], showTeam: false };

  const visible =
    user.role === 'client'
      ? clients.filter((c) => user.assignedClientIds?.includes(c.id))
      : clients;

  return {
    clients: visible.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      attention: awaitingReview(c.content ?? []),
    })),
    showTeam: user.role === 'admin',
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm run test -- src/nav.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/nav.ts src/nav.test.ts
git commit -m "Add the pure navigation model with per-client attention counts"
```

---

### Task 6: Theme defaults to light

**Files:**
- Modify: `src/contexts/ThemeContext.tsx`
- Test: `src/contexts/ThemeContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/contexts/ThemeContext.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>theme:{theme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light when nothing is stored', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('honours a stored dark choice', () => {
    localStorage.setItem('limi_theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists a toggle', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(localStorage.getItem('limi_theme')).toBe('dark');
  });

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem('limi_theme', 'banana');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test -- src/contexts/ThemeContext.test.tsx`
Expected: FAIL — first test reports `theme:dark`, because the current default is `'dark'`.

- [ ] **Step 3: Change the default and harden the stored read**

In `src/contexts/ThemeContext.tsx`, replace the `useState` initialiser:

```tsx
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('limi_theme') as Theme) ?? 'dark'
  );
```

with:

```tsx
  // Light is the default. A stored choice wins, but only if it is a real theme
  // — a stale or hand-edited value used to be cast straight to Theme and
  // applied. The OS `prefers-color-scheme` hint is deliberately not consulted:
  // this product is white by default and dark on request.
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('limi_theme');
    return stored === 'dark' || stored === 'light' ? stored : 'light';
  });
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm run test -- src/contexts/ThemeContext.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/ThemeContext.tsx src/contexts/ThemeContext.test.tsx
git commit -m "Default the theme to light and reject junk stored values"
```

---

### Task 7: `ui.ts` — the vocabulary

Add the navigation and stage-pill entries the shell needs, and retune the existing entries to the new geometry. Existing exported names are all kept so no consumer breaks.

**Files:**
- Modify: `src/ui.ts`

- [ ] **Step 1: Retune the existing surface and control entries**

In `src/ui.ts`, replace the `card`, `cardInteractive`, `tile` and `inset` declarations with:

```ts
export const card =
  'bg-surface dark:bg-surface-dark border border-hairline dark:border-hairline-dark rounded-card';

// Clickable cards get a hairline that firms up and a tint, not a lift. In this
// register nothing floats unless it is genuinely floating.
export const cardInteractive = `${card} transition-colors duration-150 hover:bg-tint dark:hover:bg-tint-dark hover:border-ink-faint/30 dark:hover:border-ink-faintdark/30 cursor-pointer`;

export const tile =
  'bg-surface dark:bg-surface-dark border border-hairline dark:border-hairline-dark rounded-card';

export const inset =
  'bg-tint dark:bg-tint-dark border border-hairline dark:border-hairline-dark rounded-tile';
```

- [ ] **Step 2: Append the navigation vocabulary**

Add to the end of `src/ui.ts`:

```ts
// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export const sidebar =
  'flex flex-col h-full bg-tint dark:bg-tint-dark border-r border-hairline dark:border-hairline-dark';

// 248px open, 48px collapsed to a rail. The rail is not optional: four kanban
// columns need the width back on a 1280px laptop.
export const SIDEBAR_WIDTH = 248;
export const SIDEBAR_RAIL = 48;

export function navItem(active: boolean) {
  return `w-full flex items-center gap-2 h-7 px-2 rounded-tile text-[13px] font-medium text-left transition-colors ${
    active
      ? 'bg-hover dark:bg-hover-dark text-ink dark:text-ink-dark'
      : 'text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark'
  }`;
}

export const navSubItem =
  'w-full flex items-center gap-2 h-7 pl-8 pr-2 rounded-tile text-[13px] text-left transition-colors text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark';

export const navGroupLabel =
  'px-2 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint dark:text-ink-faintdark';

// The count of items awaiting a client's review. Quiet by default — it is
// information, not an alarm.
export const navBadge =
  'ml-auto min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-semibold tabular-nums bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark';

export const breadcrumbBar =
  'flex items-center gap-2 h-11 px-4 border-b border-hairline dark:border-hairline-dark bg-canvas dark:bg-canvas-dark';

export const breadcrumbText = 'text-[13px] font-medium text-ink dark:text-ink-dark truncate';

export const drawerScrim = 'fixed inset-0 z-40 bg-ink/30 dark:bg-black/60 lg:hidden';

// Empty states earn their space by saying what belongs here.
export const emptyState =
  'flex flex-col items-center justify-center gap-2 py-14 px-6 text-center';
export const emptyTitle = 'text-[13px] font-semibold text-ink dark:text-ink-dark';
export const emptyBody = 'text-xs leading-relaxed text-ink-faint dark:text-ink-faintdark max-w-xs';
```

- [ ] **Step 3: Verify the app still compiles**

Run: `npx tsc --noEmit && npm run test`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui.ts
git commit -m "Add the shell vocabulary and flatten card surfaces to hairlines"
```

---

### Task 8: `Sidebar` component

Presentational only — it receives a `NavModel` and callbacks. All role logic already lives in `buildNav`.

**Files:**
- Create: `src/components/Sidebar.tsx`
- Test: `src/components/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/Sidebar.test.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { NavModel } from '../nav';

const nav: NavModel = {
  clients: [
    { id: 'acme', name: 'Acme', attention: 3 },
    { id: 'bolt', name: 'Bolt', attention: 0 },
  ],
  showTeam: true,
};

function setup(over: Partial<ComponentProps<typeof Sidebar>> = {}) {
  const props = {
    nav,
    activeClientId: undefined,
    activePath: '/',
    userEmail: 'u@x.com',
    theme: 'light' as const,
    collapsed: false,
    onNavigate: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleCollapsed: vi.fn(),
    onSignOut: vi.fn(),
    ...over,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('lists every client it is given', () => {
    setup();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Bolt')).toBeInTheDocument();
  });

  it('shows an attention count only where there is one', () => {
    setup();
    expect(screen.getByLabelText('Acme, 3 awaiting review')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Bolt, .* awaiting/)).not.toBeInTheDocument();
  });

  it('hides Team when the model says so', () => {
    setup({ nav: { ...nav, showTeam: false } });
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });

  it('shows Team when the model allows it', () => {
    setup();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('navigates when a client is clicked', async () => {
    const props = setup();
    await userEvent.click(screen.getByText('Acme'));
    expect(props.onNavigate).toHaveBeenCalledWith('/client/acme');
  });

  it('renders no client labels when collapsed to the rail', () => {
    setup({ collapsed: true });
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test -- src/components/Sidebar.test.tsx`
Expected: FAIL — `Failed to resolve import "./Sidebar"`.

- [ ] **Step 3: Implement `Sidebar.tsx`**

Create `src/components/Sidebar.tsx`:

```tsx
import { LayoutGrid, Users, Sun, Moon, PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import { NavModel } from '../nav';
import {
  sidebar, navItem, navGroupLabel, navBadge, btnIcon, heading, faintText,
} from '../ui';

interface Props {
  nav: NavModel;
  activeClientId?: string;
  activePath: string;
  userEmail: string;
  theme: 'light' | 'dark';
  collapsed: boolean;
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  onToggleCollapsed: () => void;
  onSignOut: () => void;
}

export default function Sidebar({
  nav, activeClientId, activePath, userEmail, theme, collapsed,
  onNavigate, onToggleTheme, onToggleCollapsed, onSignOut,
}: Props) {
  return (
    <nav className={sidebar} aria-label="Main">
      {/* Brand + collapse */}
      <div className="flex items-center gap-2 h-11 px-3 flex-shrink-0">
        <div className="w-5 h-5 bg-brand rounded flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-[10px] leading-none">L</span>
        </div>
        {!collapsed && <span className={`${heading} text-[13px]`}>Limi</span>}
        <button
          onClick={onToggleCollapsed}
          className={`${btnIcon} ml-auto w-7 h-7 flex-shrink-0`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        <button
          onClick={() => onNavigate('/')}
          className={navItem(activePath === '/')}
          aria-current={activePath === '/' ? 'page' : undefined}
        >
          <LayoutGrid size={14} className="flex-shrink-0" />
          {!collapsed && <span className="truncate">Clients</span>}
        </button>

        {!collapsed && <div className={navGroupLabel}>Boards</div>}

        {nav.clients.map((c) => {
          const active = c.id === activeClientId;
          const label = c.attention > 0 ? `${c.name}, ${c.attention} awaiting review` : c.name;
          return (
            <button
              key={c.id}
              onClick={() => onNavigate(`/client/${c.id}`)}
              className={navItem(active)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <span
                className="w-4 h-4 rounded flex-shrink-0 bg-hover dark:bg-hover-dark inline-flex items-center justify-center text-[9px] font-semibold text-ink-soft dark:text-ink-softdark"
                aria-hidden="true"
              >
                {c.name.charAt(0).toUpperCase()}
              </span>
              {!collapsed && <span className="truncate">{c.name}</span>}
              {!collapsed && c.attention > 0 && <span className={navBadge}>{c.attention}</span>}
            </button>
          );
        })}

        {nav.clients.length === 0 && !collapsed && (
          <p className={`px-2 py-2 text-xs ${faintText}`}>No boards yet.</p>
        )}

        {nav.showTeam && (
          <>
            {!collapsed && <div className={navGroupLabel}>Workspace</div>}
            <button
              onClick={() => onNavigate('/users')}
              className={navItem(activePath === '/users')}
              aria-current={activePath === '/users' ? 'page' : undefined}
            >
              <Users size={14} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">Team</span>}
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-hairline dark:border-hairline-dark p-2">
        {!collapsed && (
          <p className={`px-2 pb-1.5 text-[11px] truncate ${faintText}`}>{userEmail}</p>
        )}
        <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
          <button onClick={onToggleTheme} className={`${btnIcon} w-7 h-7`} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={onSignOut} className={`${btnIcon} w-7 h-7`} aria-label="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm run test -- src/components/Sidebar.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git commit -m "Add the sidebar nav tree with per-client attention counts"
```

---

### Task 9: `AppShell` layout

Owns the sidebar/drawer/breadcrumb geometry for every authenticated route.

**Files:**
- Create: `src/components/AppShell.tsx`

- [ ] **Step 1: Implement `AppShell.tsx`**

Create `src/components/AppShell.tsx`:

```tsx
import { ReactNode, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClients } from '../store';
import { buildNav } from '../nav';
import { page, breadcrumbBar, breadcrumbText, drawerScrim, btnIcon, SIDEBAR_WIDTH, SIDEBAR_RAIL } from '../ui';

const COLLAPSE_KEY = 'limi_sidebar_collapsed';

export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: activeClientId } = useParams<{ id: string }>();
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { clients } = useClients();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const nav = buildNav(clients, currentUser);
  const width = collapsed ? SIDEBAR_RAIL : SIDEBAR_WIDTH;

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      return !c;
    });
  }

  // Navigating from the drawer must also close it, or a phone user lands on the
  // new page with the drawer still covering it.
  function go(path: string) {
    navigate(path);
    setDrawerOpen(false);
  }

  const activeClientName = nav.clients.find((c) => c.id === activeClientId)?.name;
  const crumb = activeClientName ?? (location.pathname === '/users' ? 'Team' : 'Clients');

  const sidebarProps = {
    nav,
    activeClientId,
    activePath: location.pathname,
    userEmail: currentUser?.email ?? '',
    theme,
    onNavigate: go,
    onToggleTheme: toggleTheme,
    onSignOut: logout,
  };

  return (
    <div className={`${page} flex`}>
      {/* Desktop: in flow, so the main region never sits under it. */}
      <div
        className="hidden lg:block flex-shrink-0 sticky top-0 h-dvh"
        style={{ width }}
      >
        <Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>

      {/* Mobile: slide-over drawer, replacing the deleted bottom bar. */}
      {drawerOpen && (
        <>
          <div className={drawerScrim} onClick={() => setDrawerOpen(false)} />
          <div
            className="fixed inset-y-0 left-0 z-50 lg:hidden"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              onToggleCollapsed={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className={`${breadcrumbBar} sticky top-0 z-30`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className={`${btnIcon} w-7 h-7 lg:hidden`}
            aria-label="Open navigation"
          >
            <Menu size={16} />
          </button>
          <span className={breadcrumbText}>{crumb}</span>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "Add the AppShell layout with sidebar, mobile drawer and breadcrumb"
```

---

### Task 10: Wire the shell in and delete `BottomNav`

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/BottomNav.tsx`

- [ ] **Step 1: Swap `BottomNav` for `AppShell`**

In `src/App.tsx`, replace this import:

```tsx
import BottomNav from './components/BottomNav';
```

with:

```tsx
import AppShell from './components/AppShell';
```

Then replace the whole `AuthenticatedRoutes` function:

```tsx
function AuthenticatedRoutes() {
  const { status } = useAuth();
  // Wait for Firebase to resolve the session — redirecting during `loading`
  // would bounce a signed-in user to the login page on every refresh.
  if (status === 'loading') return <AuthSplash />;
  if (status !== 'signed-in') return <Navigate to="/login" replace />;
  return (
    <>
      <Routes>
        <Route path="/" element={<ClientsPage />} />
        <Route path="/client/:id" element={<ClientBoardPage />} />
        <Route path="/users" element={<UserManagementPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}
```

with:

```tsx
function AuthenticatedRoutes() {
  const { status } = useAuth();
  // Wait for Firebase to resolve the session — redirecting during `loading`
  // would bounce a signed-in user to the login page on every refresh.
  if (status === 'loading') return <AuthSplash />;
  if (status !== 'signed-in') return <Navigate to="/login" replace />;
  return (
    <Routes>
      {/* AppShell sits inside the route so useParams() can read :id for the
          breadcrumb and the active sidebar item. */}
      <Route path="/" element={<AppShell><ClientsPage /></AppShell>} />
      <Route path="/client/:id" element={<AppShell><ClientBoardPage /></AppShell>} />
      <Route path="/users" element={<AppShell><UserManagementPage /></AppShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Delete the bottom bar**

```bash
git rm src/components/BottomNav.tsx
```

- [ ] **Step 3: Verify nothing else referenced it**

Run: `grep -rn "BottomNav" src/`
Expected: no output.

- [ ] **Step 4: Verify compile, tests and build**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: all three PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "Route every authenticated page through AppShell; delete BottomNav"
```

---

### Task 11: Migrate `ClientsPage` and `ClientCard`

The shell now owns the brand, the theme toggle, the Team link and sign-out, so `ClientsPage`'s local `Header` is dead weight. Removing it also clears 14 of the file's hardcoded colours.

**Files:**
- Modify: `src/pages/ClientsPage.tsx`
- Modify: `src/components/ClientCard.tsx`

- [ ] **Step 1: Delete the local header**

In `src/pages/ClientsPage.tsx`, delete the entire `function Header() { ... }` declaration and the `<Header />` element from the returned JSX. Then remove the imports it alone used: `useNavigate`, `Sun`, `Moon`, `useTheme`, `badge`, `btnIcon`, and the `ROLE_LABELS` constant.

- [ ] **Step 2: Replace the page wrapper**

The page's outermost element currently applies `page`, which the shell now owns. Change the outer wrapper from `<div className={page}>` to:

```tsx
    <div className={`${shell} py-6`}>
```

and remove `page` from the `../ui` import list.

- [ ] **Step 3: Replace every remaining hardcoded colour**

These are the exact values present in the file. Substitute each:

| Current | Replace with |
| --- | --- |
| `bg-[#dc2626]` (×2) | `bg-brand` |
| `bg-[#b91c1c]` (×2) | `bg-brand-hover` |
| `bg-[#991b1b]` | `bg-brand-hover` |
| `dark:bg-[#1a1405]` (×2) | `dark:bg-tint-dark` |
| `dark:bg-[#111]` | `dark:bg-surface-dark` |
| `dark:border-[#1e1e1e]` | `dark:border-hairline-dark` |
| `dark:border-[#222]` | `dark:border-hairline-dark` |
| `dark:text-[#555]` | `dark:text-ink-faintdark` |
| `dark:text-[#444]` | `dark:text-ink-faintdark` |
| `dark:text-[#333]` | `dark:text-ink-faintdark` |

The three amber `#1a1405` / notification-banner cases belong to `NotifPermissionBanner`'s
styling and keep their amber Tailwind classes (`amber-50`, `amber-600`) — only the
bracketed dark values change.

Then run: `grep -n '\[#' src/pages/ClientsPage.tsx`
Expected: no output.

- [ ] **Step 4: Give the empty state something to say**

Where the page renders its "no clients" case, use the empty-state vocabulary:

```tsx
        <div className={emptyState}>
          <p className={emptyTitle}>No clients yet</p>
          <p className={emptyBody}>
            A client is a board of content with its own review loop. Add your
            first one to start scheduling posts.
          </p>
          {canAdd && (
            <button onClick={() => setAdding(true)} className={`${btnPrimary} mt-2`}>
              <Plus size={14} />
              Add client
            </button>
          )}
        </div>
```

Add `emptyState`, `emptyTitle`, `emptyBody` and `btnPrimary` to the `../ui` import. If the local state setter or permission flag is named differently in the file, use the existing names rather than renaming them.

- [ ] **Step 5: Clear `ClientCard`'s hardcoded colours**

Exact values present in this file:

| Current | Replace with |
| --- | --- |
| `bg-[#131313]` | `bg-surface dark:bg-surface-dark` (drop the literal) |
| `dark:bg-[#111]` | `dark:bg-surface-dark` |
| `dark:bg-[#1a1a1a]` | `dark:bg-tint-dark` |
| `border-[#2c2c2c]` | `border-hairline dark:border-hairline-dark` |
| `dark:border-[#1e1e1e]` | `dark:border-hairline-dark` |
| `dark:border-[#252525]` | `dark:border-hairline-dark` |
| `dark:border-[#181818]` | `dark:border-hairline-dark` |
| `dark:ring-[#1e1e1e]` | `dark:ring-hairline-dark` |
| `dark:text-[#f0f0f0]` | `dark:text-ink-dark` |
| `text-[#555]` | `text-ink-soft` |
| `dark:text-[#555]` | `dark:text-ink-faintdark` |
| `dark:text-[#444]` (×2) | `dark:text-ink-faintdark` |
| `dark:text-[#2a2a2a]` | `dark:text-ink-faintdark` |

The card's outer wrapper should use `cardInteractive` so it picks up the new
hairline-and-tint hover instead of the old lift.

Then run: `grep -n '\[#' src/components/ClientCard.tsx`
Expected: no output.

- [ ] **Step 6: Verify no hardcoded colour survives in either file**

Run: `grep -c '\[#' src/pages/ClientsPage.tsx src/components/ClientCard.tsx`
Expected: `0` for both.

- [ ] **Step 7: Verify compile, tests and build**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: all three PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ClientsPage.tsx src/components/ClientCard.tsx
git commit -m "Move the clients page onto the shell and clear its hardcoded colours"
```

---

### Task 12: Browser verification

There are no UI tests for visual structure, so verify geometry and computed styles directly — the method used for the detail-dialog rebuild.

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Use the `limi-dev` configuration in `.claude/launch.json` (do not run a server via a shell command).

- [ ] **Step 2: Confirm the page is white by default**

With `localStorage` cleared, load the app and evaluate:

```js
JSON.stringify({
  dark: document.documentElement.classList.contains('dark'),
  bodyBg: getComputedStyle(document.body).backgroundColor,
})
```

Expected: `dark: false`, and a background of `rgb(255, 255, 255)`.

- [ ] **Step 3: Confirm the sidebar geometry at desktop width**

Resize to 1440x900, then evaluate:

```js
(() => {
  const nav = document.querySelector('nav[aria-label="Main"]');
  const r = nav.getBoundingClientRect();
  return JSON.stringify({ width: Math.round(r.width), height: Math.round(r.height) });
})()
```

Expected: width `248`. Click the collapse control and re-run: width `48`.

- [ ] **Step 4: Confirm the drawer replaces it on mobile**

Resize to 375x812 and evaluate:

```js
(() => {
  const nav = document.querySelector('nav[aria-label="Main"]');
  const burger = document.querySelector('[aria-label="Open navigation"]');
  return JSON.stringify({
    sidebarMounted: !!nav,
    burgerVisible: !!burger && burger.getBoundingClientRect().width > 0,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  });
})()
```

Expected: `sidebarMounted: false` (drawer is closed), `burgerVisible: true`, `horizontalOverflow: false`. Click the burger and confirm a `nav[aria-label="Main"]` appears at width 248.

- [ ] **Step 5: Confirm the collapse choice survives a reload**

Collapse the sidebar, reload, and re-run Step 3's snippet. Expected: width `48`.

- [ ] **Step 6: Check the console is clean**

Read the console messages. Expected: no errors. React key or `aria-current` warnings must be fixed, not ignored.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "Fix issues found in Phase 1 browser verification"
```

---

## Deliberately not in Phase 1

The spec listed "density groundwork" under Phase 1. It is moved to Phase 2 on
purpose: a comfortable/compact switch has nothing to act on until the Table view
exists, and building the plumbing first would mean shipping a toggle that
changes nothing. Nothing in Phase 1 blocks it — `ui.ts` is the only place it
will need to reach.

## Done when

- `npm run test` passes: contrast maths, palette AA in both themes, four stage pills in both themes, nav model role rules, theme default, sidebar rendering.
- `npx tsc --noEmit` and `npm run build` pass.
- The app is white on first load, navigates entirely from the sidebar, and has no bottom bar.
- `grep -rn "BottomNav" src/` is empty; `ClientsPage` and `ClientCard` contain no `[#` colours.
- Phase 1's remaining hardcoded-colour debt is unchanged and expected: `ClientBoardPage` (59), `IdeasView` (48), `PublicReviewPage` (38), `ContentCard` (21), `ContentCalendar` (16), `KanbanColumn` (12), `NotifPermissionBanner` (10). These belong to Phases 2 and 4.
