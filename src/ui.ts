// Shared class strings so every surface speaks one visual language. Components
// import from here instead of each re-inventing its own border/padding recipe,
// which is how the old UI drifted.

export const card =
  'bg-surface dark:bg-surface-dark rounded-card shadow-card dark:shadow-none dark:ring-1 dark:ring-hairline-dark';

// Cards that are clickable get a small lift. Kept at 1.02 / 180ms — enough to
// register, short of distracting.
export const cardInteractive = `${card} transition-all duration-200 hover:shadow-lift hover:-translate-y-0.5 cursor-pointer motion-reduce:transition-none motion-reduce:hover:translate-y-0`;

export const tile =
  'bg-surface dark:bg-surface-dark rounded-tile shadow-card dark:shadow-none dark:ring-1 dark:ring-hairline-dark';

export const inset =
  'bg-raised dark:bg-raised-dark rounded-tile border border-hairline dark:border-hairline-dark';

export const heading = 'text-ink dark:text-ink-dark font-semibold tracking-tight';
export const bodyText = 'text-ink-soft dark:text-ink-softdark';
export const faintText = 'text-ink-faint dark:text-ink-faintdark';

export const label =
  'block text-[11px] font-semibold text-ink-faint dark:text-ink-faintdark mb-1.5 uppercase tracking-wider';

export const input =
  'w-full bg-raised dark:bg-canvas-dark border border-hairline dark:border-hairline-dark rounded-tile px-3.5 py-2.5 text-ink dark:text-ink-dark text-sm placeholder-ink-faint dark:placeholder-ink-faintdark focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all';

// min-h-11 keeps primary actions at the 44px touch target.
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-pill transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand/40';

export const btnGhost =
  'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile border border-hairline dark:border-hairline-dark text-ink-soft dark:text-ink-softdark text-sm font-medium hover:bg-raised dark:hover:bg-raised-dark transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30';

export const btnIcon =
  'inline-flex items-center justify-center w-9 h-9 rounded-full text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-raised dark:hover:bg-raised-dark transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30';

// Segmented pill navigation, as in the reference dashboards.
export const pillGroup =
  'inline-flex items-center gap-1 p-1 rounded-full bg-raised dark:bg-raised-dark border border-hairline dark:border-hairline-dark';

export function pill(active: boolean) {
  return `inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs font-semibold transition-colors ${
    active
      ? 'bg-ink dark:bg-ink-dark text-white dark:text-canvas-dark shadow-pill'
      : 'text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

export const badge =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider';

export const page = 'min-h-screen min-h-dvh bg-canvas dark:bg-canvas-dark';
export const shell = 'max-w-[1440px] mx-auto px-4 sm:px-8';
