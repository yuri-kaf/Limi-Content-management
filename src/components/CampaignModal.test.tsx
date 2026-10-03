import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignModal from './CampaignModal';
import { Business, Campaign } from '../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('CampaignModal', () => {
  it('hides the business choice when there is only one business', () => {
    render(<CampaignModal businesses={[BAKERY]} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByLabelText('Business')).not.toBeInTheDocument();
  });

  it('saves a campaign with its deliverables', async () => {
    const onSave = vi.fn();
    render(
      <CampaignModal businesses={[BAKERY, CAFE]} defaultBusinessId="b2" onClose={vi.fn()} onSave={onSave} />
    );
    await userEvent.type(screen.getByLabelText('Name'), 'Summer launch');
    await userEvent.click(screen.getByRole('button', { name: 'Live' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add deliverable' }));
    await userEvent.type(screen.getByLabelText('Deliverable 1 name'), 'Reels');
    await userEvent.selectOptions(screen.getByLabelText('Deliverable 1 type'), 'video');
    const count = screen.getByLabelText('Deliverable 1 count');
    await userEvent.clear(count);
    await userEvent.type(count, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      businessId: 'b2',
      name: 'Summer launch',
      status: 'live',
      deliverables: [{ id: expect.any(String), label: 'Reels', mediaType: 'video', target: 3 }],
    }));
  });

  it('will not save an end date before the start date', async () => {
    render(<CampaignModal businesses={[BAKERY]} onClose={vi.fn()} onSave={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Backwards');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-03' } });
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled();
    expect(screen.getByText('The end date is before the start date.')).toBeInTheDocument();
  });

  it('keeps existing deliverable ids when editing, so linked content stays linked', async () => {
    const onSave = vi.fn();
    const campaign: Campaign = {
      id: 'c1', businessId: 'b1', name: 'Summer', brief: '', status: 'live', color: 'green',
      deliverables: [{ id: 'd-keep', label: 'Reels', target: 2 }], createdAt: 1,
    };
    render(<CampaignModal campaign={campaign} businesses={[BAKERY]} onClose={vi.fn()} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    // Strict, so a stray `mediaType: undefined` — which Firestore would reject
    // if it reached the store uncleaned — fails the test.
    expect(onSave.mock.calls[0][0].deliverables)
      .toStrictEqual([{ id: 'd-keep', label: 'Reels', target: 2 }]);
  });

  it('explains why it cannot save while a deliverable is incomplete', async () => {
    render(<CampaignModal businesses={[BAKERY]} onClose={vi.fn()} onSave={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Launch');
    await userEvent.click(screen.getByRole('button', { name: 'Add deliverable' }));
    expect(screen.getByLabelText('Deliverable 1 name')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeDisabled();
    expect(screen.getByText('Each deliverable needs a name and a count of at least 1.'))
      .toBeInTheDocument();
  });

  it('removes a deliverable and keeps focus inside the dialog', async () => {
    render(<CampaignModal businesses={[BAKERY]} onClose={vi.fn()} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add deliverable' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove deliverable 1' }));
    expect(screen.queryByLabelText('Deliverable 1 name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add deliverable' })).toHaveFocus();
  });

  it('sends a cleared date as no date, so the store removes it', async () => {
    const onSave = vi.fn();
    const campaign: Campaign = {
      id: 'c1', businessId: 'b1', name: 'Summer', brief: '', status: 'live', color: 'green',
      startDate: '2026-10-01', endDate: '2026-10-20', deliverables: [], createdAt: 1,
    };
    render(<CampaignModal campaign={campaign} businesses={[BAKERY]} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave.mock.calls[0][0].startDate).toBeUndefined();
    expect(onSave.mock.calls[0][0].endDate).toBe('2026-10-20');
  });

  it('stays open with what was typed when the save fails', async () => {
    const onClose = vi.fn();
    render(<CampaignModal businesses={[BAKERY]} onClose={onClose} onSave={async () => false} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Launch');
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('Launch');
  });
});
