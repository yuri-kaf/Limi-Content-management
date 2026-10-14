import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DndContextProps, DragOverlayProps } from '@dnd-kit/core';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { LG } from '../../hooks/useMediaQuery';
import ContentBoard from './ContentBoard';
import { Campaign, ContentItem, ContentStatus } from '../../types';
import { STAGES } from '../../utils';
import { boardColumn } from '../../ui';

// A real pointer drag cannot happen in jsdom — every element measures zero —
// so the board's DndContext is wrapped to keep hold of the handlers it was
// given. The tests then call them the way dnd-kit would on a drop. The
// DragOverlay is wrapped too, to read how a drop is set to land.
const dnd = vi.hoisted(() => ({
  props: null as DndContextProps | null,
  overlay: null as DragOverlayProps | null,
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd.props = props;
      return <actual.DndContext {...props} />;
    },
    DragOverlay: (props: DragOverlayProps) => {
      dnd.overlay = props;
      return <actual.DragOverlay {...props} />;
    },
  };
});

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// jsdom has no matchMedia. The board asks two things: whether it is at least
// lg, true for the four-column desktop board, and whether the person has asked
// for reduced motion, which turns the drop animation off. Each query gets its
// own answer, so a desktop test is not also a reduced-motion one.
function stubMatchMedia(desktop: boolean, reduceMotion = false) {
  window.matchMedia = ((query: string) => ({
    matches: (query === LG && desktop) || (query === REDUCED_MOTION && reduceMotion),
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia(true);
  dnd.overlay = null;
});

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

type BoardProps = React.ComponentProps<typeof ContentBoard>;

function renderBoard(over: Partial<BoardProps> = {}) {
  const props: BoardProps = {
    content: [
      item({ id: 'a', title: 'Launch reel', campaignId: 'c1' }),
      item({ id: 'b', title: 'Menu post' }),
    ],
    campaigns: [SUMMER],
    businesses: [],
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
  const view = render(<ThemeProvider><ContentBoard {...props} /></ThemeProvider>);
  const rerender = (next: Partial<BoardProps>) =>
    view.rerender(<ThemeProvider><ContentBoard {...props} {...next} /></ThemeProvider>);
  return { ...props, rerender };
}

// The card itself, rather than one of the controls inside it. Its name is
// everything it shows, so the title is matched anywhere in it.
function card(title: string) {
  return screen.getByRole('button', { name: new RegExp(title) });
}

function focus(element: HTMLElement) {
  act(() => element.focus());
}

// The desktop column a card is drawn in. The columns sit in stage order.
function columnOf(title: string): ContentStatus | undefined {
  let el: HTMLElement | null = screen.getByText(title);
  while (el && el.className !== boardColumn) el = el.parentElement;
  return el ? STAGES[Array.from(el.parentElement!.children).indexOf(el)].id : undefined;
}

// A write that has not come back yet, and the means to finish it.
function pendingWrite() {
  let finish!: (ok: boolean) => void;
  const write = new Promise<boolean>((resolve) => { finish = resolve; });
  return { onMove: vi.fn(() => write), finish };
}

// jsdom lays nothing out, so every element measures zero and the keyboard
// sensor finds no stage to the right of a card. This gives the desktop board a
// real one's geometry: 280px columns 300px apart, cards 80px apart down each,
// and the drag copy wherever dnd-kit has placed it with fixed positioning.
function layOutBoard() {
  const box = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    for (let el: Element | null = this; el; el = el.parentElement) {
      if (el instanceof HTMLElement && el.style.position === 'fixed') {
        const { left, top, width, height } = el.style;
        return box(parseFloat(left), parseFloat(top), parseFloat(width), parseFloat(height));
      }
    }
    let column: Element | null = this;
    while (column && column.className !== boardColumn) column = column.parentElement;
    if (!column) return box(0, 0, 0, 0);
    const x = 300 * Array.from(column.parentElement!.children).indexOf(column);
    const card = this.closest('[data-stage]');
    if (card && column.contains(card)) {
      return box(x + 6, 50 + 80 * Array.from(card.parentElement!.children).indexOf(card), 268, 72);
    }
    return box(x, 44, 280, 400);
  });
}

// A card dnd-kit is carrying is marked pressed, and its live region says so.
// A key that should not lift a card leaves both alone.
function expectNothingLifted() {
  expect(document.querySelector('[aria-pressed="true"]')).toBeNull();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
}

// dnd-kit never detaches a sensor when its board unmounts, so a drag a test
// left open would go on listening to the document and take the next test's
// Enter as a drop. As a describe's afterEach it runs before Testing Library
// unmounts the board.
async function putDownAnyLiftedCard() {
  if (document.querySelector('[aria-pressed="true"]')) await userEvent.keyboard('{Escape}');
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

  it('lets go of a campaign filter once that campaign is no longer offered', async () => {
    const board = renderBoard();
    await userEvent.selectOptions(screen.getByLabelText('Campaign'), 'c1');
    expect(screen.queryByText('Menu post')).not.toBeInTheDocument();
    // Another business in scope, or the campaign deleted: it leaves the list.
    board.rerender({ campaigns: [] });
    expect(screen.getByText('Menu post')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(board.onAdd).toHaveBeenLastCalledWith('editing', undefined);
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
    expect(props.onAdd).toHaveBeenCalledWith('editing', undefined);
  });

  it('files new content under the campaign the board is filtered to', async () => {
    const props = renderBoard();
    await userEvent.selectOptions(screen.getByLabelText('Campaign'), 'c1');
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(props.onAdd).toHaveBeenCalledWith('editing', 'c1');
  });

  it("files content added from a column's + under the filtered campaign too", async () => {
    const props = renderBoard();
    await userEvent.selectOptions(screen.getByLabelText('Campaign'), 'c1');
    await userEvent.click(screen.getByRole('button', { name: 'Add to review' }));
    expect(props.onAdd).toHaveBeenCalledWith('review', 'c1');
  });
});

describe('ContentBoard — moving cards', () => {
  function drop(activeId: string, overId: string | null) {
    act(() => {
      dnd.props?.onDragEnd?.({
        active: { id: activeId },
        over: overId ? { id: overId } : null,
      } as never);
    });
  }

  it('moves a card dropped on a column to that stage', () => {
    const props = renderBoard({ content: [item({ id: 'a', status: 'editing' })] });
    drop('a', 'to-post');
    expect(props.onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'to-post');
  });

  it("moves a card dropped on another card to that card's stage", () => {
    const props = renderBoard({
      content: [item({ id: 'a', status: 'editing' }), item({ id: 'b', status: 'review' })],
    });
    drop('a', 'b');
    expect(props.onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'review');
  });

  it('does nothing when a card lands where it already is, or nowhere', () => {
    const props = renderBoard({ content: [item({ id: 'a', status: 'editing' })] });
    drop('a', 'editing');
    drop('a', null);
    expect(props.onMove).not.toHaveBeenCalled();
  });

  it('never moves anything for a client', () => {
    const props = renderBoard({ isClientRole: true, content: [item({ id: 'a', status: 'review' })] });
    drop('a', 'posted');
    expect(props.onMove).not.toHaveBeenCalled();
  });

  // The move reaches `content` only when the database echoes it back, which
  // is after the drop has been drawn and its landing measured.
  it('draws a dropped card in its new column while the move is saved', () => {
    const { onMove } = pendingWrite();
    renderBoard({ content: [item({ id: 'a', title: 'Launch reel', status: 'editing' })], onMove });
    drop('a', 'to-post');
    expect(columnOf('Launch reel')).toBe('to-post');
    expect(card('Launch reel')).toHaveAttribute('data-stage', 'to-post');
  });

  it('treats a card as already in the stage it was dropped on, before the save comes back', () => {
    const { onMove } = pendingWrite();
    renderBoard({
      content: [item({ id: 'a', status: 'editing' }), item({ id: 'b', status: 'posted' })],
      onMove,
    });
    drop('a', 'to-post');
    drop('a', 'to-post');
    expect(onMove).toHaveBeenCalledTimes(1);
    // Dropped on a card, the stage is the one that card is drawn in.
    drop('b', 'a');
    expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), 'to-post');
  });

  it('puts the card back in the column it came from when the move fails', async () => {
    const { onMove, finish } = pendingWrite();
    renderBoard({ content: [item({ id: 'a', title: 'Launch reel', status: 'editing' })], onMove });
    drop('a', 'to-post');
    expect(columnOf('Launch reel')).toBe('to-post');
    // runWrite has shown its alert and resolves false.
    await act(async () => finish(false));
    expect(columnOf('Launch reel')).toBe('editing');
  });

  it('follows the content once it shows the move, so a later change is not hidden', () => {
    const { onMove } = pendingWrite();
    const board = renderBoard({
      content: [item({ id: 'a', title: 'Launch reel', status: 'editing' })],
      onMove,
    });
    drop('a', 'to-post');
    board.rerender({ content: [item({ id: 'a', title: 'Launch reel', status: 'to-post' })] });
    expect(columnOf('Launch reel')).toBe('to-post');
    // A teammate moves it on while this write is still on its way.
    board.rerender({ content: [item({ id: 'a', title: 'Launch reel', status: 'posted' })] });
    expect(columnOf('Launch reel')).toBe('posted');
  });

  // The copy in the hand is the card that will land, so over another stage it
  // takes that stage's fill. Otherwise the drop animation settles a copy in the
  // old colour and the card changes colour the moment it lands.
  it("draws the carried copy in the stage it is over", () => {
    renderBoard({ content: [item({ id: 'a', status: 'editing' })] });
    const overlayItem = () =>
      ((dnd.overlay?.children as React.ReactElement | null)?.props as { children: React.ReactElement })
        ?.children.props.item as ContentItem;
    act(() => dnd.props?.onDragStart?.({ active: { id: 'a' } } as never));
    expect(overlayItem().status).toBe('editing');
    act(() => dnd.props?.onDragOver?.({ active: { id: 'a' }, over: { id: 'to-post' } } as never));
    expect(overlayItem().status).toBe('to-post');
    act(() => dnd.props?.onDragOver?.({ active: { id: 'a' }, over: null } as never));
    expect(overlayItem().status).toBe('editing');
    act(() => dnd.props?.onDragCancel?.({ active: { id: 'a' } } as never));
  });

  it('settles a dropped card into its slot', () => {
    renderBoard();
    expect(dnd.overlay?.dropAnimation).toEqual(expect.objectContaining({ duration: 220 }));
  });

  it('puts a dropped card down without animating it for someone who asked for less motion', () => {
    stubMatchMedia(true, true);
    renderBoard();
    expect(dnd.overlay?.dropAnimation).toBeNull();
  });
});

describe('ContentBoard — keyboard', () => {
  afterEach(putDownAnyLiftedCard);

  it('opens a card on Enter, rather than lifting it', async () => {
    const props = renderBoard();
    focus(card('Launch reel'));
    await userEvent.keyboard('{Enter}');
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expectNothingLifted();
  });

  it('lifts a card on Space, and puts it back on Escape', async () => {
    renderBoard();
    const reel = card('Launch reel');
    focus(reel);
    await userEvent.keyboard(' ');
    expect(reel).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Escape}');
    expect(reel).not.toHaveAttribute('aria-pressed');
  });

  it('drops a lifted card on Enter, without also opening it', async () => {
    const props = renderBoard();
    const reel = card('Launch reel');
    focus(reel);
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');
    expect(reel).not.toHaveAttribute('aria-pressed');
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("edits on Enter or Space on a card's Edit button, without lifting the card", async () => {
    const props = renderBoard();
    const edit = within(card('Launch reel')).getByRole('button', { name: 'Edit' });
    focus(edit);
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(props.onEdit).toHaveBeenCalledTimes(2);
    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(props.onOpen).not.toHaveBeenCalled();
    expectNothingLifted();
  });

  it("opens the sheet on Enter on a card's Delete button, where the delete is confirmed", async () => {
    const props = renderBoard();
    focus(within(card('Launch reel')).getByRole('button', { name: 'Delete' }));
    await userEvent.keyboard('{Enter}');
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expectNothingLifted();
  });

  it("follows a card's link on Enter, without lifting or opening the card", async () => {
    const props = renderBoard({
      content: [item({ id: 'a', title: 'Launch reel', driveLink: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/view' })],
    });
    const link = within(card('Launch reel')).getByRole('link', { name: 'Open in Google Drive' });
    // jsdom cannot navigate, so the click is recorded and stopped there.
    const followed = vi.fn((e: Event) => e.preventDefault());
    link.addEventListener('click', followed);
    focus(link);
    await userEvent.keyboard('{Enter}');
    expect(followed).toHaveBeenCalled();
    expect(props.onOpen).not.toHaveBeenCalled();
    expectNothingLifted();
  });

  // The card is unmounted from one column and mounted in another, so focus
  // survives only if the new card is in place when dnd-kit goes to restore it.
  it('keeps focus on a card carried to another stage', async () => {
    const layout = layOutBoard();
    try {
      const { onMove } = pendingWrite();
      const board = renderBoard({
        content: [item({ id: 'a', title: 'Launch reel', status: 'editing' })],
        onMove,
      });
      focus(card('Launch reel'));
      await userEvent.keyboard(' ');
      await userEvent.keyboard('{ArrowRight}');
      await userEvent.keyboard(' ');
      expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'review');
      await waitFor(() => expect(card('Launch reel')).toHaveFocus());
      expect(columnOf('Launch reel')).toBe('review');
      // The database echoes the move back a tick later.
      board.rerender({ content: [item({ id: 'a', title: 'Launch reel', status: 'review' })] });
      await waitFor(() => expect(card('Launch reel')).toHaveFocus());
      expect(columnOf('Launch reel')).toBe('review');
    } finally {
      layout.mockRestore();
    }
  });

  it('tells a screen reader that Enter opens a card and Space lifts it', () => {
    renderBoard();
    expect(card('Launch reel')).toHaveAccessibleDescription(/Enter to open .* Space to pick it up/);
  });
});

describe('ContentBoard — the copy in the hand', () => {
  afterEach(putDownAnyLiftedCard);

  // The copy's title has to wrap at the card's width, or the copy is a
  // different height from the card it lands on.
  it('has the same controls as the card it was lifted from', async () => {
    renderBoard({ canDeleteItem: () => false });
    focus(card('Launch reel'));
    await userEvent.keyboard(' ');
    const [lifted, copy] = screen
      .getAllByText('Launch reel')
      .map((title) => title.closest('[data-stage]') as HTMLElement);
    const controls = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('a, button'), (c) => c.getAttribute('aria-label'));
    expect(controls(copy)).toEqual(controls(lifted));
    expect(controls(copy)).toContain('Edit');
    expect(controls(copy)).not.toContain('Delete');
  });
});

describe('ContentBoard — what a screen reader hears', () => {
  afterEach(putDownAnyLiftedCard);

  // Ids shaped like Firestore's, which dnd-kit's own announcements read out.
  const content = [
    item({ id: 'xK9fQ2', title: 'Launch reel', status: 'editing' }),
    item({ id: 'pL3mZ8', title: 'Menu post', status: 'to-post' }),
  ];
  const reel = { id: 'xK9fQ2' } as never;
  const over = (id: string) => ({ id }) as never;
  const say = () => dnd.props!.accessibility!.announcements!;

  it('names a lifted card by its title and stage, and says when it is put back', async () => {
    renderBoard({ content });
    focus(card('Launch reel'));
    await userEvent.keyboard(' ');
    // dnd-kit reports the card as over its own spot the moment it is lifted;
    // naming that stage again would cut this off.
    expect(screen.getByRole('status')).toHaveTextContent('Picked up Launch reel from Editing.');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('status')).toHaveTextContent('Launch reel was put back in Editing.');
  });

  it('names the stage under a carried card only when it changes', () => {
    renderBoard({ content });
    say().onDragStart({ active: reel });
    expect(say().onDragOver({ active: reel, over: over('xK9fQ2') })).toBeUndefined();
    expect(say().onDragOver({ active: reel, over: over('to-post') })).toBe('Launch reel is over To Post.');
    // Another card in the same column is the same stage.
    expect(say().onDragOver({ active: reel, over: over('pL3mZ8') })).toBeUndefined();
    expect(say().onDragOver({ active: reel, over: null })).toBe('Launch reel is not over a stage.');
    expect(say().onDragOver({ active: reel, over: over('editing') })).toBe('Launch reel is over Editing.');
  });

  it('says what a drop did', () => {
    renderBoard({ content });
    expect(say().onDragEnd({ active: reel, over: over('pL3mZ8') }))
      .toBe('Moved Launch reel from Editing to To Post.');
    expect(say().onDragEnd({ active: reel, over: over('editing') })).toBe('Launch reel stays in Editing.');
    expect(say().onDragEnd({ active: reel, over: null })).toBe('Launch reel stays in Editing.');
  });
});

describe('ContentBoard — a client board', () => {
  afterEach(putDownAnyLiftedCard);

  function renderClientBoard() {
    return renderBoard({
      isClientRole: true,
      campaignFilter: false,
      content: [item({ id: 'r', title: 'For you', status: 'review' })],
    });
  }

  it('opens a card on Enter, where approving and declining happen', async () => {
    const props = renderClientBoard();
    focus(card('For you'));
    await userEvent.keyboard('{Enter}');
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'r' }));
    expectNothingLifted();
  });

  it('opens a card on Space too, rather than lifting it into a drag nothing can finish', async () => {
    const props = renderClientBoard();
    focus(card('For you'));
    await userEvent.keyboard(' ');
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'r' }));
    expectNothingLifted();
  });

  it('gives its cards none of the drag machinery', () => {
    renderClientBoard();
    expect(card('For you')).not.toHaveAttribute('aria-roledescription');
    expect(card('For you')).not.toHaveAttribute('aria-describedby');
  });
});

describe('ContentBoard — phone', () => {
  beforeEach(() => stubMatchMedia(false));
  afterEach(putDownAnyLiftedCard);

  // Only one column is mounted below lg, so a lifted card could only ever be
  // dropped back where it started.
  it('lifts nothing on a long press', async () => {
    renderBoard();
    fireEvent.touchStart(card('Launch reel'), { touches: [{ clientX: 10, clientY: 10 }] });
    // Past the touch sensor's 200ms hold.
    await act(() => new Promise((resolve) => setTimeout(resolve, 250)));
    expectNothingLifted();
  });

  it('opens a card on Space as well as Enter, since Space has nothing to lift', async () => {
    const props = renderBoard();
    focus(card('Launch reel'));
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');
    expect(props.onOpen).toHaveBeenCalledTimes(2);
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expectNothingLifted();
  });

  it('shows every stage as a tab and adds into the one selected', async () => {
    const props = renderBoard();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    await userEvent.click(screen.getByRole('tab', { name: /To Post/ }));
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(props.onAdd).toHaveBeenCalledWith('to-post', undefined);
  });

  it("starts a client on the stage that is waiting for them", () => {
    renderBoard({ isClientRole: true, campaignFilter: false });
    const selected = screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveTextContent('Your review');
  });
});
