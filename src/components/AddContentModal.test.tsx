import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddContentModal from './AddContentModal';
import { Business, Campaign } from '../types';

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

  it('reports no campaign as null, so an edit can take an item out of one', async () => {
    const onSubmit = renderModal({ businesses: [BAKERY], campaigns: [] });
    await userEvent.type(screen.getByLabelText('Content Title'), 'Plain post');
    await userEvent.type(screen.getByLabelText('Drive Link'), 'https://example.com/x.png');
    await userEvent.click(screen.getByRole('button', { name: 'Add Content' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b1', campaignId: null, deliverableId: null,
    }));
  });
});
