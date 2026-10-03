import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import ContentBoard from './ContentBoard';
import { Campaign, ContentItem } from '../../types';

// jsdom has no matchMedia. Report a desktop width so the four-column board
// renders rather than the phone's stage tabs.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => localStorage.clear());

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

function renderBoard(over: Partial<React.ComponentProps<typeof ContentBoard>> = {}) {
  const props = {
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
  render(<ThemeProvider><ContentBoard {...props} /></ThemeProvider>);
  return props;
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
});
