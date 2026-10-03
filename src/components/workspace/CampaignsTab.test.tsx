import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignsTab from './CampaignsTab';
import { Business, Campaign, CampaignStatus, ContentItem } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };

function campaign(id: string, name: string, status: CampaignStatus, over: Partial<Campaign> = {}): Campaign {
  return {
    id, businessId: 'b1', name, brief: '', status, color: 'green', deliverables: [], createdAt: 1, ...over,
  };
}

function renderTab(over: Partial<React.ComponentProps<typeof CampaignsTab>> = {}) {
  const props = {
    campaigns: [campaign('c3', 'Done', 'completed'), campaign('c2', 'Plan', 'planning'), campaign('c1', 'Now', 'live')],
    content: [] as ContentItem[],
    businesses: [BAKERY],
    canManage: true,
    onOpen: vi.fn(),
    onNew: vi.fn(),
    ...over,
  };
  render(<CampaignsTab {...props} />);
  return props;
}

describe('CampaignsTab', () => {
  it('groups campaigns live, then planning, then completed', () => {
    renderTab();
    const groups = screen.getAllByRole('region');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Live', 'Planning', 'Completed']);
    expect(within(groups[0]).getByText('Now')).toBeInTheDocument();
  });

  it('shows deliverable progress on the card', () => {
    const summer = campaign('c1', 'Summer', 'live', {
      deliverables: [{ id: 'd1', label: 'Reels', target: 3 }],
    });
    const posted = {
      id: 'r1', title: 'Reel', driveLink: '', driveFileId: '', status: 'posted', createdAt: 1,
      uploadedByEmail: 'a@b.c', clientReview: 'approved', campaignId: 'c1', deliverableId: 'd1',
    } as ContentItem;
    renderTab({ campaigns: [summer], content: [posted] });
    expect(screen.getByText('1 of 3 posted')).toBeInTheDocument();
    expect(screen.getByText('Reels 1/3')).toBeInTheDocument();
  });

  it('opens a campaign from its card', async () => {
    const props = renderTab();
    await userEvent.click(screen.getByText('Now'));
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('starts a new campaign from the header', async () => {
    const props = renderTab();
    await userEvent.click(screen.getByRole('button', { name: 'New campaign' }));
    expect(props.onNew).toHaveBeenCalled();
  });

  it('offers New campaign only to the team', () => {
    renderTab({ canManage: false });
    expect(screen.queryByRole('button', { name: 'New campaign' })).not.toBeInTheDocument();
  });

  it('says why there is no New campaign before the client has a business', () => {
    renderTab({ campaigns: [], canManage: false, setupNeeded: true });
    expect(screen.getByText(/this client has none yet/)).toBeInTheDocument();
  });

  it('explains campaigns when there are none', () => {
    renderTab({ campaigns: [] });
    expect(screen.getByText('No campaigns yet')).toBeInTheDocument();
  });
});
