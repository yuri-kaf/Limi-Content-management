// Shared class strings so every surface speaks one visual language. Components
// import from here instead of each re-inventing its own border/padding recipe,
// which is how the old UI drifted.

// Keyboard focus, one recipe everywhere. A solid 2px ring in the neutral
// `focus` ink on a 2px canvas-coloured offset, so it reads at 3:1 or better
// whatever the control's own fill (color.test.ts asserts it), and only for
// keyboard focus: a mouse click does not leave a ring behind. Red is kept for
// errors: an input marked aria-invalid draws a 2px brand-text edge instead.
export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:focus-visible:ring-focus-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas dark:focus-visible:ring-offset-canvas-dark';

// The same ring drawn inside the element, for rows and tabs that sit edge to
// edge in a clipped container, where an outer ring would be cut off.
export const focusRingInset =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus dark:focus-visible:ring-focus-dark';

export const card =
  'bg-raised dark:bg-raised-dark rounded-card';

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
  'transition-[transform,box-shadow,background-color,filter] duration-150 ease-out-soft [@media(hover:hover)]:hover:shadow-e1 [@media(hover:hover)]:active:shadow-none active:scale-[.99]';

// Clickable cards lift off the page, and their hairline firms up as they do.
// A shadow does not show on the dark canvas, so dark mode tints on hover too.
export const cardInteractive =
  `${card} ${lift} hover:bg-hover/70 dark:hover:bg-hover-dark cursor-pointer`;

export const tile =
  'bg-raised dark:bg-raised-dark rounded-card';

export const inset =
  'bg-raised dark:bg-raised-dark rounded-tile';

export const heading =
  'text-ink dark:text-ink-dark font-medium';
export const bodyText = 'text-ink-soft dark:text-ink-softdark';
export const faintText = 'text-ink-faint dark:text-ink-faintdark';

export const label =
  'block text-[12px] font-medium text-ink-soft dark:text-ink-softdark mb-1.5';

// Focus is a 2px ink edge (border plus a 1px ring). An invalid field is a 2px
// red edge instead; focused, it keeps the red border and gains the ink ring on
// an offset outside it, so focus never disappears into the error styling.
export const input =
  'w-full bg-raised dark:bg-raised-dark border border-transparent hover:bg-hover/60 dark:hover:bg-hover-dark/60 rounded-tile px-3 py-2 min-h-10 text-ink dark:text-ink-dark text-[13px] placeholder-ink-faint dark:placeholder-ink-faintdark focus:outline-none focus-visible:border-focus dark:focus-visible:border-focus-dark focus-visible:ring-1 focus-visible:ring-focus dark:focus-visible:ring-focus-dark aria-[invalid=true]:!border-brand-text dark:aria-[invalid=true]:!border-brand-textdark aria-[invalid=true]:ring-1 aria-[invalid=true]:!ring-brand-text dark:aria-[invalid=true]:!ring-brand-textdark aria-[invalid=true]:focus-visible:!ring-2 aria-[invalid=true]:focus-visible:!ring-focus dark:aria-[invalid=true]:focus-visible:!ring-focus-dark aria-[invalid=true]:focus-visible:ring-offset-2 aria-[invalid=true]:focus-visible:ring-offset-canvas dark:aria-[invalid=true]:focus-visible:ring-offset-canvas-dark transition-all';

// The compact size, for toolbars and inline banners where a 44px button would
// outweigh what is around it: 36px under a pointer, 44px where there is none,
// as Notion's toolbars do. A size is a recipe, not an override: stacked on
// btnPrimary, an h-9 loses to its min-h-11 (recipeOverrides.test.ts).
const btnSm =
  'inline-flex items-center justify-center gap-1.5 h-8 [@media(hover:none)]:h-10 px-3.5 rounded-full text-[13px] whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export const btnPrimarySm =
  `${btnSm} bg-brand hover:bg-brand-hover text-white font-medium ${focusRing}`;

export const btnGhostSm =
  `${btnSm} bg-hover dark:bg-hover-dark text-ink dark:text-ink-dark font-medium hover:bg-pressed dark:hover:bg-pressed-dark ${focusRing}`;

// In the warning fill, for the action inside a warning banner (a pending data
// migration).
export const btnWarningSm =
  `${btnSm} bg-warning hover:bg-warning-hover text-white font-medium ${focusRing}`;

// min-h-11 keeps primary actions at the 44px touch target.
export const btnPrimary =
  `inline-flex items-center justify-center gap-2 min-h-10 [@media(hover:none)]:min-h-12 px-5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand hover:bg-brand-hover text-white ${focusRing}`;

export const btnGhost =
  `inline-flex items-center justify-center gap-2 min-h-10 [@media(hover:none)]:min-h-12 px-5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-hover dark:bg-hover-dark text-ink dark:text-ink-dark hover:bg-pressed dark:hover:bg-pressed-dark ${focusRing}`;

// rounded-tile, not rounded-full: a circular icon button was the last
// consumer-app radius left in a system of 6px controls and 12px cards, and a
// header holding one of each reads as two designs.
export const btnIcon =
  `inline-flex items-center justify-center w-8 h-8 [@media(hover:none)]:w-10 [@media(hover:none)]:h-10 rounded-full text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark hover:bg-ink/[.08] dark:hover:bg-ink-dark/[.08] transition-colors ${focusRing}`;

// An icon button that turns destructive on hover. The `!` is needed: btnIcon's
// own hover colours would otherwise win by stylesheet order.
export const btnIconDanger =
  `${btnIcon} hover:!text-brand-text dark:hover:!text-brand-textdark hover:!bg-brand-soft dark:hover:!bg-brand-softdark`;

// The top app bar's icon buttons: the Material 40px, 48px to a finger.
export const btnIconBar =
  `inline-flex items-center justify-center w-10 h-10 [@media(hover:none)]:w-12 [@media(hover:none)]:h-12 rounded-full text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark hover:bg-ink/[.08] dark:hover:bg-ink-dark/[.08] transition-colors ${focusRing}`;

// A small round action floating over a tile's corner, like a Finder badge:
// its own surface, hairline and shadow, so it reads over whatever is under it.
// 28px for a pointer, 36px where there is none, and there a transparent
// ::before reaching 4px past each edge makes the touch target 44px without the
// badge growing. Its user positions it (absolute), which anchors the ::before.
export const badgeBtn =
  `w-7 h-7 [@media(hover:none)]:w-9 [@media(hover:none)]:h-9 [@media(hover:none)]:before:content-[''] [@media(hover:none)]:before:absolute [@media(hover:none)]:before:-inset-1 inline-flex items-center justify-center rounded-full bg-canvas dark:bg-raised-dark shadow-e1 text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark transition-[opacity,color] duration-150 ${focusRing}`;

// Hidden until its `group` is hovered or holds focus, and always shown where
// nothing can hover. Pair with a transition on opacity, as badgeBtn has.
export const revealOnGroupHover =
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';

// Today's date in a calendar: its number in a filled brand circle, the one
// mark it needs. White on the brand red is 4.8:1 (color.test.ts).
export const todayMark =
  'inline-flex items-center justify-center h-6 min-w-6 px-1 rounded-full bg-brand text-white text-[12px] font-medium tabular-nums';

// Segmented pill navigation, as in the reference dashboards.
export const pillGroup =
  'inline-flex items-center gap-1';

export function pill(active: boolean) {
  return `inline-flex items-center gap-1.5 px-3 h-8 rounded-tile text-[12px] font-medium transition-colors ${focusRing} ${
    active
      ? 'bg-ink dark:bg-ink-dark text-white dark:text-canvas-dark'
      : 'bg-raised dark:bg-raised-dark text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

export const badge =
  'inline-flex items-center gap-1 px-1.5 h-5 rounded-chip text-[11px] font-medium whitespace-nowrap';

// Multi-select chips — media type, platforms, and anything else where several
// options sit side by side. Selected reads as a brand tint rather than a fill,
// so a row of them doesn't compete with the primary action.
// Filled pills, never outlined (Ashim: chips and secondary controls are
// filled; the selected one is the deeper brand fill).
export function chip(active: boolean) {
  return `inline-flex items-center justify-center gap-1.5 px-3 h-8 [@media(hover:none)]:h-10 rounded-full text-[12px] font-medium border transition-colors ${focusRing} ${
    active
      ? 'bg-brand-soft dark:bg-brand-softdark border-transparent text-brand-on dark:text-brand-ondark'
      : 'bg-raised dark:bg-raised-dark border-transparent text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// Approve / decline and other semantic actions. Tinted rather than filled —
// the filled treatment stays reserved for the one primary action on a surface.
export const btnSuccess =
  `inline-flex items-center justify-center gap-2 min-h-10 [@media(hover:none)]:min-h-12 px-5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-success-soft dark:bg-success-softdark text-success-text dark:text-success-textdark hover:bg-success-softhover dark:hover:bg-success-softhoverdark ${focusRing}`;

// The filled form, for the one surface where approving *is* the primary action:
// the public review page a client acts on without signing in.
export const btnSuccessSolid =
  `inline-flex items-center justify-center gap-2 min-h-10 [@media(hover:none)]:min-h-12 px-5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-success hover:bg-success-hover text-white ${focusRing}`;

export const btnDanger =
  `inline-flex items-center justify-center gap-2 min-h-10 [@media(hover:none)]:min-h-12 px-5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark hover:bg-brand-softhover dark:hover:bg-brand-softhoverdark ${focusRing}`;

// A ghost button that turns destructive on hover — for delete affordances that
// shouldn't shout until they're aimed at.
export const btnGhostDanger =
  `${btnGhost} hover:!text-brand-on dark:hover:!text-brand-ondark hover:!bg-brand-soft dark:hover:!bg-brand-softdark`;

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

// One overlay recipe everywhere: dimmed, blurred canvas. Modals that want a
// mobile bottom sheet override the alignment classes after this.
export const overlay =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/[.32] dark:bg-black/60 animate-fade-in';

// Panels carry will-change for good, not just while they enter: Safari drops
// the compositing layer when the entrance ends and re-rasterises the panel
// under the blurred overlay, which showed as a dip of a pixel or two.
//
// The cost: will-change: transform makes the panel the containing block for
// every `position: fixed` descendant, as a real transform would. A dropdown,
// popover or tooltip inside a dialog that positions itself with `fixed`
// against the viewport will be placed against the panel instead, and clipped
// by its overflow. Render those through a portal to document.body.
export const modalPanel =
  'w-full max-w-md p-6 bg-canvas dark:bg-raised-dark rounded-dialog shadow-lift max-h-[90dvh] overflow-y-auto animate-scale-in [will-change:transform,opacity]';

// Bottom sheet on phones, centred dialog from `sm` up — for the taller,
// media-led modals where a sheet reads more naturally on a small screen.
export const sheetOverlay =
  'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-black/[.32] dark:bg-black/60 animate-fade-in';

// A sheet rises from the bottom edge on a phone and scales in as a dialog from
// `sm` up, matching where it sits in each layout.
export const sheetPanel =
  'w-full sm:max-w-lg bg-canvas dark:bg-raised-dark rounded-t-dialog sm:rounded-dialog shadow-lift overflow-hidden overflow-y-auto max-h-[92dvh] animate-sheet-up sm:animate-scale-in [will-change:transform,opacity]';

export const modalTitle =
  'text-ink dark:text-ink-dark text-[20px] leading-7 font-normal';

// Section headings inside a modal body — smaller and quieter than `label`,
// which belongs to form fields.
export const sectionLabel =
  'text-[12px] font-medium text-ink-soft dark:text-ink-softdark';

// Helper copy under a field.
export const hint =
  'text-[12px] leading-4 text-ink-faint dark:text-ink-faintdark mt-1.5';

// The "(optional)" / "(internal only)" aside inside a uppercase label.
export const labelAside =
  'font-normal text-ink-faint dark:text-ink-faintdark';

export const textarea = `${input} resize-none`;

// Read-only prose blocks (caption, hashtags, notes) in the detail modal.
export const readout =
  `${inset} p-3 text-[13px] leading-relaxed whitespace-pre-wrap ${bodyText}`;

// A hairline rule separating stacked sections inside a modal body.
export const divider =
  'pt-3 border-t border-hairline dark:border-hairline-dark';

export const page = 'min-h-screen min-h-dvh bg-canvas dark:bg-canvas-dark';
// The shell's centring and padding without its width, for a page that sets a
// narrower max-width of its own. Stacking a max-w-* on `shell` is unreliable:
// Tailwind orders same-property utilities itself, so which width wins depends
// on how the two values sort, not on their order in the class list.
export const shellPad = 'mx-auto px-4 sm:px-8';
export const shell = shellPad;
// A client view's body: anchored to the 20px edge its title row and business
// chips share, never centred under a left-aligned header.
export const viewPad = 'px-5';

// A wide, two-pane detail dialog. Bottom sheet on phones; from lg up a centred
// panel whose header and footer stay put while the two panes scroll on their
// own. Distinct from sheetPanel, which scrolls as a single column and so lets
// the media and the close button slide away.
export const sheetPanelWide =
  'w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl bg-canvas dark:bg-raised-dark rounded-t-dialog sm:rounded-dialog shadow-lift flex flex-col max-h-[92dvh] overflow-hidden animate-sheet-up sm:animate-scale-in [will-change:transform,opacity]';

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
// A filled track with the chosen option as a deeper pill: no outlines.
export const segmented =
  'inline-flex items-stretch h-8 p-0.5 gap-0.5 rounded-full bg-raised dark:bg-raised-dark';

export function segItem(active: boolean) {
  return `inline-flex items-center gap-1.5 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${focusRingInset} ${
    active
      ? 'bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark'
      : 'text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// A count beside a label. Distinct from `navBadge`, which hangs at the end of a
// nav row: this one sits inline and must not read as part of the label next to
// it — which is exactly what a bare grey number did on the column headers.
export const countChip =
  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium tabular-nums bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark';

// ---------------------------------------------------------------------------
// Queue rows (Today)
// ---------------------------------------------------------------------------

// A list of rows inside one hairline box, separated by rules rather than by
// nothing. Thirteen equal-weight rows in an undivided box is a wall, not a list.
export const rowList =
  'flex flex-col gap-0.5';

// 52px: two lines of text at the 44px touch minimum plus breathing room. The
// title owns the width; the client and the reason sit under it.
export const queueRow =
  `w-full flex items-center gap-3 px-3 py-1.5 min-h-12 rounded-card text-left transition-colors hover:bg-raised dark:hover:bg-raised-dark focus-visible:bg-raised dark:focus-visible:bg-raised-dark ${focusRingInset}`;

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export const sidebar =
  'flex flex-col h-full bg-tint dark:bg-tint-dark';

// 248px open, 48px collapsed to a rail. The rail is not optional: four kanban
// columns need the width back on a 1280px laptop.
export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_RAIL = 72;

export function navItem(active: boolean) {
  return `w-full flex items-center gap-3 h-9 px-3 rounded-full text-[13px] text-left transition-colors ${focusRingInset} ${
    active
      ? 'bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark font-semibold'
      : 'text-ink-soft dark:text-ink-softdark font-medium hover:bg-ink/[.06] dark:hover:bg-ink-dark/[.08] hover:text-ink dark:hover:text-ink-dark'
  }`;
}

export const navSubItem =
  `w-full flex items-center gap-3 h-9 pl-3 pr-3 rounded-full text-[13px] text-left transition-colors text-ink-soft dark:text-ink-softdark hover:bg-ink/[.06] dark:hover:bg-ink-dark/[.08] ${focusRingInset}`;

export const navGroupLabel =
  'flex items-center px-3 pt-4 pb-1 text-[12px] font-medium text-ink-faint dark:text-ink-faintdark';

// The count of items awaiting a client's review. Quiet by default — it is
// information, not an alarm.
export const navBadge =
  'ml-auto min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[11px] font-medium tabular-nums text-ink-soft dark:text-ink-softdark';

export const breadcrumbBar =
  'flex items-center gap-2 h-[52px] px-2 bg-tint dark:bg-tint-dark';

export const breadcrumbText =
  'text-[16px] font-normal text-ink dark:text-ink-dark truncate';

export const drawerScrim =
  'fixed inset-0 z-40 bg-black/[.32] dark:bg-black/60 lg:hidden animate-fade-in';

// Empty states earn their space by saying what belongs here.
export const emptyState =
  'flex flex-col items-center justify-center gap-2 py-14 px-6 text-center';
export const emptyTitle =
  'text-[14px] font-medium text-ink dark:text-ink-dark';
export const emptyBody =
  'text-[13px] leading-5 text-ink-faint dark:text-ink-faintdark max-w-xs';

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

// The shell owns the viewport and nothing outside a designated region scrolls.
// A kanban board needs to know how tall it is so its columns can scroll
// independently; a page that grows forever cannot offer that.
export const appRoot =
  'h-dvh overflow-hidden flex bg-tint dark:bg-tint-dark';

// One horizontal row of columns. Replaces a 2x2 grid, in which a move between
// stages on different rows was a diagonal drag — the geometry that made
// drag-and-drop unreliable in the first place.
export const boardScroller = 'flex-1 min-h-0 overflow-x-auto overflow-y-hidden';
// min-w-full rather than min-w-max: the columns share whatever width the
// window has. When it runs out they hold at 260px and the row scrolls; the
// after: spacer keeps the right padding once it does.
export const boardRow =
  'flex gap-2 h-full pl-4 pb-3 min-w-full after:content-[""] after:w-2 after:flex-shrink-0';
// Columns grow to fill a wide screen (no empty strip to the right of Backup)
// but never go below 260px, so on a 1280px laptop or a phone the next column
// still peeks in and advertises the scroll.
export const boardColumn =
  'flex flex-col flex-1 basis-0 min-w-[260px] flex-shrink-0 h-full min-h-0 bg-raised dark:bg-raised-dark rounded-card';

// Pinned so you always know which stage you are looking at, however far down
// the column you have scrolled.
export const columnHeader =
  'flex items-center gap-2 h-10 px-3 flex-shrink-0 sticky top-0 z-10';

// The cards sit straight on the page, as in the Weihu reference: a column is a
// lane, not a grey box. The padding is room for a lifted card's shadow, which
// the scroll container would otherwise clip.
export const columnBody =
  'flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-1.5 px-1.5 pb-1.5 rounded-card border border-transparent transition-colors';

// A page toolbar: one row, everything on it, so the board keeps the height.
export const pageToolbar =
  'flex items-center gap-2 px-4 h-12 flex-shrink-0';

// A quiet inline "add" that lives in a column header rather than shouting from
// the page. 28px, not 24: a 24px target fails the touch minimum by a mile and
// this one is reachable on a phone.
export const columnAdd =
  `w-7 h-7 rounded-full inline-flex items-center justify-center text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-ink/[.08] dark:hover:bg-ink-dark/[.08] transition-colors ${focusRing}`;

// The drop target while a card is over a column: a dashed outline and a faint
// wash, so the lane shows itself only when it matters. The `!` is needed
// because columnBody's border-transparent sets the same property, and Tailwind,
// not the class list, decides which of two same-property utilities wins.
export const columnBodyOver =
  'border-dashed !border-ink-faint/40 dark:!border-ink-faintdark/40 bg-hover/60 dark:bg-hover-dark/60';

// ---------------------------------------------------------------------------
// Board — phone layout
// ---------------------------------------------------------------------------

// Below lg the board is one full-width column with the stages as tabs, not a
// horizontally scrolled row. Hand-scrolling sideways to reach Posted hides how
// many stages exist and how much sits in each; tabs show all four counts at
// once and cost one tap instead of three swipes.
export const stageTabRow =
  'flex items-stretch gap-0 px-2 flex-shrink-0 border-b border-hairline dark:border-hairline-dark overflow-x-auto [scrollbar-width:none]';

// 44px tall, equal thirds/quarters of the width, active marked by a 2px rule in
// the stage's own colour — so the colour vocabulary already used by the pills
// carries the selection rather than a second, unrelated highlight.
export function stageTab(active: boolean) {
  return `flex-1 min-w-0 flex flex-col items-center justify-center h-12 gap-0.5 border-b-[3px] -mb-px transition-colors ${focusRingInset} ${
    active
      ? 'border-brand text-brand-text dark:text-brand-textdark'
      : 'border-transparent text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// On a phone there is only one column, so nothing needs distinguishing from
// anything: the tinted, bordered box that separates four columns on the desktop
// board is pure frame here, and it costs 22px of card width per side.
// The padding is inside the scroll region, so a lifted card's shadow and a
// focus ring at the edge are not clipped by it.
export const columnBodyPlain =
  'flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-1.5 px-3 pt-2 pb-5';

// One column, full width, its own scroll region. The desktop board keeps the
// fixed 280px columns; this is the same column body at a different width.
export const boardSingle = 'flex-1 min-h-0 flex flex-col';

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
  return `inline-flex items-center gap-1.5 h-full px-3 border-b-[3px] text-[13px] font-medium whitespace-nowrap transition-colors ${focusRingInset} ${
    active
      ? `${indicator ? 'border-transparent' : 'border-brand'} text-brand-text dark:text-brand-textdark`
      : 'border-transparent text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark'
  }`;
}

// Business scope chips: quiet until chosen, like a nav row.
export function scopeChip(active: boolean) {
  return `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap border transition-colors ${focusRing} ${
    active
      ? 'bg-brand-soft dark:bg-brand-softdark border-transparent text-brand-on dark:text-brand-ondark'
      : 'bg-raised dark:bg-raised-dark border-transparent text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark'
  }`;
}


// The browser's own chrome (a phone's status bar, the installed app's title
// bar) takes the colour of the app's top bar: Tailwind's `tint` token. Kept in
// step with index.html's inline script, which sets it before React mounts.
export const THEME_BAR = { light: '#f3f3f4', dark: '#1c1b1f' } as const;
