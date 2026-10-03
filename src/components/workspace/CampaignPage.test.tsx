import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import CampaignPage from './CampaignPage';
import { Business, Campaign, ContentItem } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };

const SUMMER: Campaign = {
  id: 'c1', businessId: 'b1', name: 'Summer launch', brief: 'Push the new menu.', status: 'live',
  color: 'green', deliverables: [{ id: 'd1', label: 'Reels', mediaType: 'video', target: 3 }], createdAt: 1,
};

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

const CONTENT = [
  item({ id: 'r1', title: 'Reel one', campaignId: 'c1', deliverableId: 'd1', status: 'posted' }),
  item({ id: 'x', title: 'Loose post', campaignId: 'c1' }),
  item({ id: 'y', title: 'Elsewhere' }),
];

function renderPage(over: Partial<React.ComponentProps<typeof CampaignPage>> = {}) {
  const props = {
    campaign: SUMMER,
    content: CONTENT,
    businesses: [BAKERY],
    canManage: true,
    canEditItem: () => true,
    canDeleteItem: () => true,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onSetStatus: vi.fn(),
    onOpenItem: vi.fn(),
    onAddContent: vi.fn(),
    onEditItem: vi.fn(),
    onMoveItem: vi.fn(),
    ...over,
  };
  render(<ThemeProvider><CampaignPage {...props} /></ThemeProvider>);
  return props;
}

describe('CampaignPage', () => {
  beforeEach(() => localStorage.clear());

  it('shows the brief, each deliverable with its progress, and unslotted content', () => {
    renderPage();
    expect(screen.getByText('Push the new menu.')).toBeInTheDocument();
    expect(screen.getByText('1/3 posted')).toBeInTheDocument();
    expect(screen.getByText('Reel one')).toBeInTheDocument();
    expect(screen.getByText('Loose post')).toBeInTheDocument();
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument();
  });

  it('adds content straight into a deliverable', async () => {
    const props = renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Add to Reels' }));
    expect(props.onAddContent).toHaveBeenCalledWith({ status: 'editing', deliverableId: 'd1' });
  });

  it('changes status from the header', async () => {
    const props = renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'completed');
    expect(props.onSetStatus).toHaveBeenCalledWith('completed');
  });

  it('hides editing controls from someone who cannot manage campaigns', () => {
    renderPage({ canManage: false });
    expect(screen.queryByRole('button', { name: 'Add to Reels' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });
});
