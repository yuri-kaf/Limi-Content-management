import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import OverviewTab from './OverviewTab';
import { Business, Campaign, Client, ContentItem } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(businesses: Business[], content: ContentItem[] = []): Client {
  return { id: 'acme', name: 'Acme', about: '', content, businesses, createdAt: 1 };
}

function renderOverview(c: Client, over: Partial<React.ComponentProps<typeof OverviewTab>> = {}) {
  const props = {
    client: c,
    content: c.content,
    campaigns: [],
    allCampaigns: [],
    businessId: undefined,
    canManage: true,
    onSelectBusiness: vi.fn(),
    onEditBusiness: vi.fn(),
    onAddBusiness: vi.fn(),
    onOpenItem: vi.fn(),
    onOpenCampaign: vi.fn(),
    ...over,
  };
  render(<ThemeProvider><OverviewTab {...props} /></ThemeProvider>);
  return props;
}

describe('OverviewTab', () => {
  beforeEach(() => localStorage.clear());

  it('shows no business layer for a single business', () => {
    renderOverview(client([BAKERY]));
    expect(screen.queryByRole('region', { name: 'Businesses' })).not.toBeInTheDocument();
  });

  it('shows a card per business and scopes to the one pressed', async () => {
    const props = renderOverview(client([BAKERY, CAFE]));
    expect(screen.getByRole('region', { name: 'Businesses' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Cafe/ }));
    expect(props.onSelectBusiness).toHaveBeenCalledWith('b2');
  });

  it('lists work waiting on the client under its business, and opens it', async () => {
    const waiting = item({ id: 'w', title: 'Menu reel', status: 'review', businessId: 'b2' });
    const props = renderOverview(client([BAKERY, CAFE], [waiting]));
    await userEvent.click(screen.getByRole('button', { name: /Menu reel — Cafe/ }));
    expect(props.onOpenItem).toHaveBeenCalledWith(waiting);
  });

  it('widens back to every business when the one in scope is pressed again', async () => {
    const props = renderOverview(client([BAKERY, CAFE]), { businessId: 'b2' });
    await userEvent.click(screen.getByRole('button', { name: /^Cafe/ }));
    expect(props.onSelectBusiness).toHaveBeenCalledWith(undefined);
  });

  it('keeps completed campaigns out of Active campaigns', () => {
    const campaign = (id: string, name: string, status: Campaign['status']): Campaign => ({
      id, businessId: 'b1', name, brief: '', status, color: 'green', deliverables: [], createdAt: 1,
    });
    const both = [campaign('c1', 'Spring push', 'live'), campaign('c2', 'Old launch', 'completed')];
    renderOverview(client([BAKERY]), { campaigns: both, allCampaigns: both });
    expect(screen.getByText('Spring push')).toBeInTheDocument();
    expect(screen.queryByText('Old launch')).not.toBeInTheDocument();
  });

  it('says so when nothing needs attention', () => {
    renderOverview(client([BAKERY]));
    expect(screen.getByText(/Nothing needs attention/)).toBeInTheDocument();
  });
});
