import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DndContextProps } from '@dnd-kit/core';
import { ThemeProvider } from '../../contexts/ThemeContext';
import ContentBoard from './ContentBoard';
import { Campaign, ContentItem } from '../../types';

// A real pointer drag cannot happen in jsdom — every element measures zero —
// so the board's DndContext is wrapped to keep hold of the handlers it was
// given. The tests then call them the way dnd-kit would on a drop.
const dnd = vi.hoisted(() => ({ props: null as DndContextProps | null }));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd.props = props;
      return <actual.DndContext {...props} />;
    },
  };
});

// jsdom has no matchMedia. `matches` is the answer to the board's one query,
// "is this at least lg?" — true for the four-column desktop board.
function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia(true);
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
});

describe('ContentBoard — phone', () => {
  beforeEach(() => stubMatchMedia(false));

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
