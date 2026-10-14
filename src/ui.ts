// Shared class strings so every surface speaks one visual language. Components
// import from here instead of each re-inventing its own border/padding recipe,
// which is how the old UI drifted.

export const card =
  'bg-surface dark:bg-surface-dark border border-hairline dark:border-hairline-dark rounded-card';

// Raised on hover and pressed in on click: the one motion every clickable card
// shares. Hover applies only where the pointer can hover, so a tap on a phone
// never leaves a card stuck in the air. Reduced motion is handled globally in
// index.css.
//
// A `[@media(hover:hover)]:` rule compiles after all of Tailwind's own, so an
// ordinary `active:` class loses to it however the class list is ordered, which
// is why the press carries the same prefix. Overriding the lift takes a `!`, or
// a `[@media(hover:hover)]:` class whose own variant sorts after `hover:`, as
// `active:` does here; a second `[@media(hover:hover)]:hover:` class wins or
// loses by its name.
export const lift =
  'transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out-soft [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-float [@media(hover:hover)]:active:translate-y-0 [@media(hover:hover)]:active:shadow-none active:scale-[.98]';

// Clickable cards lift off the page, and their hairline firms up as they do.
// A shadow does not show on the dark canvas, so dark mode tints on hover too.
export const cardInteractive = `${card} ${lift} hover:border-ink-faint/30 dark:hover:border-ink-faintdark/30 dark:hover:bg-tint-dark cursor-pointer`;

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

// rounded-tile, not rounded-full: a circular icon button was the last
// consumer-app radius left in a system of 6px controls and 12px cards, and a
// header holding one of each reads as two designs.
export const btnIcon =
  'inline-flex items-center justify-center w-9 h-9 rounded-tile text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-raised dark:hover:bg-raised-dark transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30';

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
      ? 'bg-brand-soft dark:bg-brand-softdark border-brand/40 text-brand-text dark:text-brand-textdark'
      : 'bg-raised dark:bg-raised-dark border-hairline dark:border-hairline-dark text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// Approve / decline and other semantic actions. Tinted rather than filled —
// the filled treatment stays reserved for the one primary action on a surface.
export const btnSuccess =
  'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile text-sm font-semibold border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

export const btnDanger =
  'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile text-sm font-semibold border border-brand/30 dark:border-brand/40 bg-brand-soft dark:bg-brand-softdark text-brand-text dark:text-brand-textdark hover:bg-brand-softhover dark:hover:bg-brand-softhoverdark transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30';

// A ghost button that turns destructive on hover — for delete affordances that
// shouldn't shout until they're aimed at.
export const btnGhostDanger = `${btnGhost} hover:!text-brand-text dark:hover:!text-brand-textdark hover:!bg-brand-soft dark:hover:!bg-brand-softdark hover:border-brand/30`;

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

// One overlay recipe everywhere: dimmed, blurred canvas. Modals that want a
// mobile bottom sheet override the alignment classes after this.
export const overlay =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 dark:bg-black/70 backdrop-blur-md animate-fade-in';

export const modalPanel =
  'w-full max-w-md p-6 bg-surface dark:bg-surface-dark rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark max-h-[90dvh] overflow-y-auto animate-scale-in';

// Bottom sheet on phones, centred dialog from `sm` up — for the taller,
// media-led modals where a sheet reads more naturally on a small screen.
export const sheetOverlay =
  'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-ink/40 dark:bg-black/70 backdrop-blur-md animate-fade-in';

// A sheet rises from the bottom edge on a phone and scales in as a dialog from
// `sm` up, matching where it sits in each layout.
export const sheetPanel =
  'w-full sm:max-w-lg bg-surface dark:bg-surface-dark rounded-t-card sm:rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark overflow-hidden overflow-y-auto max-h-[92dvh] animate-sheet-up sm:animate-scale-in';

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
// The shell's centring and padding without its width, for a page that sets a
// narrower max-width of its own. Stacking a max-w-* on `shell` is unreliable:
// Tailwind orders same-property utilities itself, so which width wins depends
// on how the two values sort, not on their order in the class list.
export const shellPad = 'mx-auto px-4 sm:px-8';
export const shell = `max-w-[1440px] ${shellPad}`;

// A wide, two-pane detail dialog. Bottom sheet on phones; from lg up a centred
// panel whose header and footer stay put while the two panes scroll on their
// own. Distinct from sheetPanel, which scrolls as a single column and so lets
// the media and the close button slide away.
export const sheetPanelWide =
  'w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl bg-surface dark:bg-surface-dark rounded-t-card sm:rounded-card shadow-lift dark:ring-1 dark:ring-hairline-dark flex flex-col max-h-[92dvh] overflow-hidden animate-sheet-up sm:animate-scale-in';

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
// Segmented control
// ---------------------------------------------------------------------------

// Replaces the rounded-full pill group for view switching. A `rounded-full`
// control with a filled black active state is a consumer-app gesture; in this
// register a view switcher is an inset strip whose active segment is *raised*
// out of it. Same 6px geometry as the other controls, so the toolbar stops
// carrying two competing radii. The segment's own 3px is the strip's 6px less
// its 1px border and 2px padding, which keeps the two concentric.
export const segmented =
  'inline-flex items-center gap-0.5 p-0.5 rounded-tile bg-tint dark:bg-tint-dark border border-hairline dark:border-hairline-dark';

export function segItem(active: boolean) {
  return `inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[3px] text-[12px] font-medium whitespace-nowrap transition-colors ${
    active
      ? 'bg-canvas dark:bg-hover-dark text-ink dark:text-ink-dark shadow-[0_1px_2px_rgba(15,15,15,0.07)]'
      : 'text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// A count beside a label. Distinct from `navBadge`, which hangs at the end of a
// nav row: this one sits inline and must not read as part of the label next to
// it — which is exactly what a bare grey number did on the column headers.
export const countChip =
  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-tile text-[11px] font-semibold tabular-nums bg-tint dark:bg-tint-dark text-ink-soft dark:text-ink-softdark';

// ---------------------------------------------------------------------------
// Queue rows (Today)
// ---------------------------------------------------------------------------

// A list of rows inside one hairline box, separated by rules rather than by
// nothing. Thirteen equal-weight rows in an undivided box is a wall, not a list.
export const rowList = `${card} divide-y divide-hairline dark:divide-hairline-dark overflow-hidden`;

// 52px: two lines of text at the 44px touch minimum plus breathing room. The
// title owns the width; the client and the reason sit under it.
export const queueRow =
  'w-full flex items-center gap-3 px-3 py-2 min-h-[52px] text-left transition-colors hover:bg-hover dark:hover:bg-hover-dark focus:outline-none focus-visible:bg-hover dark:focus-visible:bg-hover-dark';

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

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

// The shell owns the viewport and nothing outside a designated region scrolls.
// A kanban board needs to know how tall it is so its columns can scroll
// independently; a page that grows forever cannot offer that.
export const appRoot = 'h-dvh overflow-hidden flex bg-canvas dark:bg-canvas-dark';

// One horizontal row of fixed-width columns. Replaces a 2x2 grid, in which a
// move between stages on different rows was a diagonal drag — the geometry that
// made drag-and-drop unreliable in the first place.
export const boardScroller = 'flex-1 min-h-0 overflow-x-auto overflow-y-hidden';
export const boardRow = 'flex gap-2 h-full px-4 pb-4 min-w-max';
// 280px so four columns plus the 248px sidebar fit a 1440px window without
// horizontal scroll — the most common desktop size — while still leaving the
// next column peeking on a phone, which is what advertises the scroll.
export const boardColumn = 'flex flex-col w-[280px] flex-shrink-0 h-full min-h-0';

// Pinned so you always know which stage you are looking at, however far down
// the column you have scrolled.
export const columnHeader =
  'flex items-center gap-2 h-9 px-1.5 flex-shrink-0 sticky top-0 z-10 bg-canvas dark:bg-canvas-dark';

// The cards sit straight on the page, as in the Weihu reference: a column is a
// lane, not a grey box. The padding is room for a lifted card's shadow, which
// the scroll container would otherwise clip.
export const columnBody =
  'flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 p-1.5 rounded-card border border-transparent transition-colors';

// A page toolbar: one row, everything on it, so the board keeps the height.
export const pageToolbar =
  'flex items-center gap-3 px-4 h-12 flex-shrink-0 border-b border-hairline dark:border-hairline-dark';

// A quiet inline "add" that lives in a column header rather than shouting from
// the page. 28px, not 24: a 24px target fails the touch minimum by a mile and
// this one is reachable on a phone.
export const columnAdd =
  'w-7 h-7 rounded-tile inline-flex items-center justify-center text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30';

// The drop target while a card is over a column: a dashed outline and a faint
// wash, so the lane shows itself only when it matters. The `!` is needed
// because columnBody's border-transparent sets the same property, and Tailwind,
// not the class list, decides which of two same-property utilities wins.
export const columnBodyOver =
  'border-dashed !border-ink-faint/40 dark:!border-ink-faintdark/40 bg-tint/70 dark:bg-tint-dark/70';

// ---------------------------------------------------------------------------
// Board — phone layout
// ---------------------------------------------------------------------------

// Below lg the board is one full-width column with the stages as tabs, not a
// horizontally scrolled row. Hand-scrolling sideways to reach Posted hides how
// many stages exist and how much sits in each; tabs show all four counts at
// once and cost one tap instead of three swipes.
export const stageTabRow =
  'flex items-stretch gap-1 px-2 flex-shrink-0 border-b border-hairline dark:border-hairline-dark';

// 44px tall, equal thirds/quarters of the width, active marked by a 2px rule in
// the stage's own colour — so the colour vocabulary already used by the pills
// carries the selection rather than a second, unrelated highlight.
export function stageTab(active: boolean) {
  return `flex-1 min-w-0 flex flex-col items-center justify-center h-11 gap-0.5 border-b-2 -mb-px transition-colors focus:outline-none ${
    active
      ? 'text-ink dark:text-ink-dark'
      : 'border-transparent text-ink-faint dark:text-ink-faintdark hover:text-ink-soft dark:hover:text-ink-softdark'
  }`;
}

// On a phone there is only one column, so nothing needs distinguishing from
// anything: the tinted, bordered box that separates four columns on the desktop
// board is pure frame here, and it costs 22px of card width per side.
export const columnBodyPlain =
  'flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 pb-2';

// One column, full width, its own scroll region. The desktop board keeps the
// fixed 280px columns; this is the same column body at a different width.
export const boardSingle = 'flex-1 min-h-0 flex flex-col px-3 pb-3 pt-2';

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

// `indicator` is true once WorkspaceTabs has measured the row and draws the
// one sliding underline itself; until then the current tab draws its own.
export function workspaceTab(active: boolean, indicator = false) {
  return `inline-flex items-center h-full px-2 border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:bg-hover dark:focus-visible:bg-hover-dark ${
    active
      ? `${indicator ? 'border-transparent' : 'border-ink dark:border-ink-dark'} text-ink dark:text-ink-dark`
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

// A compact native select for toolbars. 44px tall, like the buttons beside it:
// their h-9 overrides lose to btnPrimary's own min-h-11 (Tailwind orders
// same-property utilities itself), so the toolbar's real height is 44px.
export const toolbarSelect =
  'h-11 min-w-0 max-w-[140px] sm:max-w-[200px] bg-canvas dark:bg-canvas-dark border border-hairline dark:border-hairline-dark rounded-tile px-2 text-[12px] font-medium text-ink-soft dark:text-ink-softdark focus:outline-none focus:ring-2 focus:ring-brand/30';
