// Shared class strings so every surface speaks one visual language. Components
// import from here instead of each re-inventing its own border/padding recipe,
// which is how the old UI drifted.

export const card =
  'bg-surface dark:bg-surface-dark border border-hairline dark:border-hairline-dark rounded-card';

// Clickable cards get a hairline that firms up and a tint, not a lift. In this
// register nothing floats unless it is genuinely floating.
export const cardInteractive = `${card} transition-colors duration-150 hover:bg-tint dark:hover:bg-tint-dark hover:border-ink-faint/30 dark:hover:border-ink-faintdark/30 cursor-pointer`;

export const tile =
  'bg-surface dark:bg-surface-dark border border-hairline dark:border-hairline-dark rounded-card';

export const inset =
  'bg-tint dark:bg-tint-dark border border-hairline dark:border-hairline-dark rounded-tile';

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

// Multi-select chips — media type, platforms, and anything else where several
// options sit side by side. Selected reads as a brand tint rather than a fill,
// so a row of them doesn't compete with the primary action.
export function chip(active: boolean) {
  return `inline-flex items-center justify-center gap-2 px-3 min-h-9 rounded-tile text-xs font-semibold border transition-colors ${
    active
      ? 'bg-brand-soft dark:bg-brand-softdark border-brand/40 text-brand'
      : 'bg-raised dark:bg-raised-dark border-hairline dark:border-hairline-dark text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// Approve / decline and other semantic actions. Tinted rather than filled —
// the filled treatment stays reserved for the one primary action on a surface.
export const btnSuccess =
  'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile text-sm font-semibold border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

export const btnDanger =
  'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile text-sm font-semibold border border-brand/30 dark:border-red-900/60 bg-brand-soft dark:bg-red-950/40 text-brand dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30';

// A ghost button that turns destructive on hover — for delete affordances that
// shouldn't shout until they're aimed at.
export const btnGhostDanger = `${btnGhost} hover:!text-brand hover:!bg-brand-soft dark:hover:!bg-brand-softdark hover:border-brand/30`;

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

// One overlay recipe everywhere: dimmed, blurred canvas. Modals that want a
// mobile bottom sheet override the alignment classes after this.
export const overlay =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 dark:bg-black/70 backdrop-blur-md';

export const modalPanel =
  'w-full max-w-md p-6 bg-surface dark:bg-surface-dark rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark max-h-[90dvh] overflow-y-auto';

// Bottom sheet on phones, centred dialog from `sm` up — for the taller,
// media-led modals where a sheet reads more naturally on a small screen.
export const sheetOverlay =
  'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-ink/40 dark:bg-black/70 backdrop-blur-md';

export const sheetPanel =
  'w-full sm:max-w-lg bg-surface dark:bg-surface-dark rounded-t-card sm:rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark overflow-hidden overflow-y-auto max-h-[92dvh]';

export const modalTitle = `${heading} text-base`;

// Section headings inside a modal body — smaller and quieter than `label`,
// which belongs to form fields.
export const sectionLabel =
  'text-[11px] font-semibold uppercase tracking-wider text-ink-faint dark:text-ink-faintdark';

// Helper copy under a field.
export const hint = 'text-[11px] leading-relaxed text-ink-faint dark:text-ink-faintdark mt-1.5';

// The "(optional)" / "(internal only)" aside inside a uppercase label.
export const labelAside = 'normal-case font-normal tracking-normal text-ink-faint dark:text-ink-faintdark';

export const textarea = `${input} resize-none`;

// Read-only prose blocks (caption, hashtags, notes) in the detail modal.
export const readout = `${inset} p-3 text-sm leading-relaxed whitespace-pre-wrap ${bodyText}`;

// A hairline rule separating stacked sections inside a modal body.
export const divider = 'pt-3 border-t border-hairline dark:border-hairline-dark';

export const page = 'min-h-screen min-h-dvh bg-canvas dark:bg-canvas-dark';
export const shell = 'max-w-[1440px] mx-auto px-4 sm:px-8';

// A wide, two-pane detail dialog. Bottom sheet on phones; from lg up a centred
// panel whose header and footer stay put while the two panes scroll on their
// own. Distinct from sheetPanel, which scrolls as a single column and so lets
// the media and the close button slide away.
export const sheetPanelWide =
  'w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl bg-surface dark:bg-surface-dark rounded-t-card sm:rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark flex flex-col max-h-[92dvh] overflow-hidden';

// One scroll region per pane below lg, two above it. min-h-0 is what actually
// lets a flex child scroll instead of growing past its parent.
export const sheetBody =
  'flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]';

export const sheetPane = 'p-5 flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain';

// Read-only prose capped at four lines and scrolled past that, so a long
// caption can't push everything below it off the dialog. 4 lines at text-sm /
// leading-relaxed is 91px, plus the 24px of vertical padding from `readout`.
export const readoutScroll = `${readout} max-h-[7.25rem] overflow-y-auto overscroll-contain`;

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
