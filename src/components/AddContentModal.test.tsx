import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddContentModal from './AddContentModal';
import { Business, Campaign, ContentItem } from '../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };
const SUMMER: Campaign = {
  id: 'c1', businessId: 'b2', name: 'Summer', brief: '', status: 'live', color: 'green',
  deliverables: [{ id: 'd1', label: 'Carousels', mediaType: 'graphic', target: 2 }], createdAt: 1,
};

function renderModal(props: Partial<React.ComponentProps<typeof AddContentModal>> = {}) {
  const onSubmit = vi.fn();
  render(<AddContentModal defaultStatus="editing" onClose={vi.fn()} onSubmit={onSubmit} {...props} />);
  return onSubmit;
}

// An item already filed under Cafe's Summer campaign, as its Carousels slot.
const FILED = {
  id: 'x', title: 'Menu reel', driveLink: 'https://example.com/menu.png', driveFileId: '',
  status: 'editing', createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending',
  mediaType: 'video', businessId: 'b2', campaignId: 'c1', deliverableId: 'd1',
} as ContentItem;

async function fillRequired() {
  await userEvent.type(screen.getByLabelText('Content Title'), 'Menu carousel');
  await userEvent.type(screen.getByLabelText('Drive Link'), 'https://example.com/menu.png');
}

describe('AddContentModal — filing', () => {
  it('shows no business or campaign fields for one business without campaigns', () => {
    renderModal({ businesses: [BAKERY], campaigns: [] });
    expect(screen.queryByLabelText('Business')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Campaign/)).not.toBeInTheDocument();
  });

  it("files the item under the campaign's business and the chosen deliverable", async () => {
    const onSubmit = renderModal({ businesses: [BAKERY, CAFE], campaigns: [SUMMER] });
    await userEvent.selectOptions(screen.getByLabelText(/Campaign/), 'c1');
    expect(screen.getByLabelText('Business')).toHaveValue('b2');
    await userEvent.selectOptions(screen.getByLabelText(/Fills/), 'd1');
    await userEvent.type(screen.getByLabelText('Content Title'), 'Menu carousel');
    await userEvent.type(screen.getByLabelText('Drive Link'), 'https://example.com/menu.png');
    await userEvent.click(screen.getByRole('button', { name: 'Add Content' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b2', campaignId: 'c1', deliverableId: 'd1', mediaType: 'graphic',
    }));
  });

  it('drops the campaign when the business changes to one it does not belong to', async () => {
    renderModal({ businesses: [BAKERY, CAFE], campaigns: [SUMMER], defaultCampaignId: 'c1' });
    expect(screen.getByLabelText(/Campaign/)).toHaveValue('c1');
    await userEvent.selectOptions(screen.getByLabelText('Business'), 'b1');
    expect(screen.getByLabelText(/Campaign/)).toHaveValue('');
  });

  it('groups campaigns by business when there are several, so same-named ones can be told apart', () => {
    const bakerySummer: Campaign = { ...SUMMER, id: 'c0', businessId: 'b1' };
    renderModal({ businesses: [BAKERY, CAFE], campaigns: [bakerySummer, SUMMER] });
    const groups = screen.getByLabelText(/Campaign/).querySelectorAll('optgroup');
    expect(Array.from(groups, (g) => g.label)).toEqual(['Bakery', 'Cafe']);
  });

  it('lists campaigns flat for a single business', () => {
    renderModal({ businesses: [CAFE], campaigns: [SUMMER] });
    expect(screen.getByLabelText(/Campaign/).querySelectorAll('optgroup')).toHaveLength(0);
    expect(screen.getByRole('option', { name: 'Summer' })).toBeInTheDocument();
  });

  it('reports no campaign as null, so an edit can take an item out of one', async () => {
    const onSubmit = renderModal({ businesses: [BAKERY], campaigns: [] });
    await userEvent.type(screen.getByLabelText('Content Title'), 'Plain post');
    await userEvent.type(screen.getByLabelText('Drive Link'), 'https://example.com/x.png');
    await userEvent.click(screen.getByRole('button', { name: 'Add Content' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b1', campaignId: null, deliverableId: null,
    }));
  });

  it('leaves the filing alone on an edit that never touches it', async () => {
    const onSubmit = renderModal({ businesses: [BAKERY, CAFE], campaigns: [SUMMER], existingItem: FILED });
    await userEvent.type(screen.getByLabelText('Content Title'), ' v2');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    const data = onSubmit.mock.calls[0][0];
    expect(data.businessId).toBe('b2');
    expect('campaignId' in data).toBe(false);
    expect('deliverableId' in data).toBe(false);
  });

  it('does not unlink an item edited before its campaigns have loaded', async () => {
    const onSubmit = vi.fn();
    const modal = (campaigns: Campaign[]) => (
      <AddContentModal
        defaultStatus="editing"
        existingItem={FILED}
        businesses={[BAKERY, CAFE]}
        campaigns={campaigns}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const { rerender } = render(modal([]));
    rerender(modal([SUMMER]));
    // Once the list arrives the picker shows the stored campaign, not "No campaign".
    expect(screen.getByLabelText(/Campaign/)).toHaveValue('c1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect('campaignId' in onSubmit.mock.calls[0][0]).toBe(false);
  });

  it('takes an item out of its campaign when No campaign is chosen', async () => {
    const onSubmit = renderModal({ businesses: [BAKERY, CAFE], campaigns: [SUMMER], existingItem: FILED });
    await userEvent.selectOptions(screen.getByLabelText(/Campaign/), '');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b2', campaignId: null, deliverableId: null,
    }));
  });

  it('keeps an edited item\'s media type when it is filed under a deliverable', async () => {
    const unfiled = { ...FILED, campaignId: undefined, deliverableId: undefined };
    const onSubmit = renderModal({ businesses: [BAKERY, CAFE], campaigns: [SUMMER], existingItem: unfiled });
    await userEvent.selectOptions(screen.getByLabelText(/Campaign/), 'c1');
    await userEvent.selectOptions(screen.getByLabelText(/Fills/), 'd1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      mediaType: 'video', campaignId: 'c1', deliverableId: 'd1',
    }));
  });

  it('pre-fills new content from a campaign deliverable, media type included', async () => {
    const onSubmit = renderModal({
      businesses: [BAKERY, CAFE], campaigns: [SUMMER], defaultCampaignId: 'c1', defaultDeliverableId: 'd1',
    });
    expect(screen.getByLabelText(/Fills/)).toHaveValue('d1');
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Add Content' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b2', campaignId: 'c1', deliverableId: 'd1', mediaType: 'graphic',
    }));
  });

  it('files new content under the business in scope when no campaign is chosen', async () => {
    const onSubmit = renderModal({ businesses: [BAKERY, CAFE], campaigns: [], defaultBusinessId: 'b2' });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Add Content' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b2', campaignId: null, deliverableId: null,
    }));
  });
});
