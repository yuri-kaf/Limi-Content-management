import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadModal from './LeadModal';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { Lead, LeadDraft } from '../../types';

const TODAY = '2026-11-02';

const MOMO: Lead = {
  id: 'momo', name: 'Momo House', source: 'instagram', status: 'denied', lostReason: 'no-budget',
  instagram: 'momo.house', note: '', ownerEmail: 'i@limi.test', ownerName: 'Ichchha',
  createdAt: 1, updatedAt: 1, statusAt: 1,
};

function setup(props: Partial<React.ComponentProps<typeof LeadModal>> = {}) {
  const onSave = vi.fn<[LeadDraft], Promise<boolean>>().mockResolvedValue(true);
  const onClose = vi.fn();
  const onOpenLead = vi.fn();
  render(
    <ThemeProvider>
      <LeadModal leads={[MOMO]} today={TODAY} onClose={onClose} onSave={onSave} onOpenLead={onOpenLead} {...props} />
    </ThemeProvider>
  );
  return { onSave, onClose, onOpenLead };
}

// Pasting is a single change event; typing a URL key by key is not how it
// arrives, so the tests paste.
function paste(el: HTMLElement, text: string) {
  fireEvent.change(el, { target: { value: text } });
}

describe('LeadModal', () => {
  it('turns a pasted TikTok link into the name, handle and source', async () => {
    const { onSave } = setup();
    paste(screen.getByLabelText('Business'), 'https://www.tiktok.com/@chiya.ghar?lang=en');
    expect(screen.getByLabelText('Business')).toHaveValue('Chiya Ghar');
    expect(screen.getByLabelText('TikTok')).toHaveValue('chiya.ghar');

    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chiya Ghar', tiktok: 'chiya.ghar', source: 'tiktok', status: 'approached' })
    );
  });

  it('moves a link pasted into the wrong platform field to the right one', () => {
    setup();
    paste(screen.getByLabelText('Instagram'), 'https://www.tiktok.com/@chiya.ghar');
    expect(screen.getByLabelText('Instagram')).toHaveValue('');
    expect(screen.getByLabelText('TikTok')).toHaveValue('chiya.ghar');
  });

  it('warns about a business that is already a lead, and opens it', async () => {
    const { onOpenLead } = setup();
    await userEvent.type(screen.getByLabelText('Instagram'), '@Momo.House');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Momo House');
    expect(alert).toHaveTextContent('Denied');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenLead).toHaveBeenCalledWith('momo');
  });

  it('keeps the source and status for the next lead after "Add another"', async () => {
    const { onSave, onClose } = setup();
    await userEvent.type(screen.getByLabelText('Business'), 'Cafe One');
    await userEvent.selectOptions(screen.getByLabelText('Status of Cafe One'), 'new');
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Business')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('1 added');
    expect(screen.getByLabelText('Status of this lead')).toHaveValue('new');
  });

  it('asks why when a lead is denied, and does not offer Onboarded', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Business'), 'Cafe One');
    const status = screen.getByLabelText('Status of Cafe One');
    expect(status.querySelector('option[value="onboarded"]')).toBeNull();
    await userEvent.selectOptions(status, 'denied');
    expect(screen.getByLabelText('Why not')).toHaveValue('not-interested');
  });

  it('sets a follow-up from a preset', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('Business'), 'Cafe One');
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ followUpOn: '2026-11-09' }));
  });
});
