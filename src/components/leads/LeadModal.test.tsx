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

beforeEach(() => localStorage.clear());

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

function pasteInto(el: HTMLElement, text: string) {
  fireEvent.paste(el, { clipboardData: { getData: () => text } });
}

describe('LeadModal', () => {
  it('has only the fields a new lead needs', () => {
    setup();
    for (const name of ['Client name', 'Business name', 'Phone / WhatsApp', 'Email', 'Website', 'Social media link', 'Notes']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Status of this lead')).toBeInTheDocument();
    expect(screen.queryByLabelText('Instagram')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next week' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull();
  });

  it('saves a lead with only a client name, named after the client', async () => {
    const { onSave, onClose } = setup();
    await userEvent.type(screen.getByLabelText('Client name'), 'John Carter');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'John Carter', contactName: 'John Carter' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a lead with only a business name', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('Business name'), 'Glow Med Spa');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Glow Med Spa', status: 'approached' }));
  });

  it('asks for one of the two names when both are empty', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Add a client name or a business name.')).toBeInTheDocument();
    expect(screen.getByLabelText('Business name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('formats the phone as a US number by default and saves it with the code', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('Business name'), 'Glow Med Spa');
    await userEvent.type(screen.getByLabelText('Phone / WhatsApp'), '2145550199');
    expect(screen.getByLabelText('Phone / WhatsApp')).toHaveValue('(214) 555-0199');
    expect(screen.getByLabelText('Country code')).toHaveValue('US');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ phone: '+1 (214) 555-0199', whatsapp: true }));
  });

  it('switches the country, and remembers it for the next lead', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('Business name'), 'Chiya Ghar');
    await userEvent.selectOptions(screen.getByLabelText('Country code'), 'NP');
    await userEvent.type(screen.getByLabelText('Phone / WhatsApp'), '9841234567');
    expect(screen.getByLabelText('Phone / WhatsApp')).toHaveValue('984-1234567');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ phone: '+977 984-1234567' }));
    document.body.innerHTML = '';

    setup();
    expect(screen.getByLabelText('Country code')).toHaveValue('NP');
  });

  it('picks the country from a number pasted with its code', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Phone / WhatsApp'), { target: { value: '+977 984 123 4567' } });
    expect(screen.getByLabelText('Country code')).toHaveValue('NP');
    expect(screen.getByLabelText('Phone / WhatsApp')).toHaveValue('984-1234567');
  });

  it('fills the fields from a pasted business card', async () => {
    const { onSave } = setup();
    pasteInto(screen.getByLabelText('Business name'), 'Glow Med Spa | (214) 555-0199 | hello@glowspa.com | glowspa.com');
    expect(screen.getByLabelText('Business name')).toHaveValue('Glow Med Spa');
    expect(screen.getByLabelText('Phone / WhatsApp')).toHaveValue('(214) 555-0199');
    expect(screen.getByLabelText('Email')).toHaveValue('hello@glowspa.com');
    expect(screen.getByLabelText('Website')).toHaveValue('glowspa.com');
    expect(screen.getByText(/Filled in from the paste/)).toHaveTextContent('phone, email, website');

    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Glow Med Spa', phone: '+1 (214) 555-0199', email: 'hello@glowspa.com', website: 'glowspa.com',
    }));
  });

  it('turns a pasted TikTok link into the name, handle and source', async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'https://www.tiktok.com/@chiya.ghar?lang=en' } });
    expect(screen.getByLabelText('Business name')).toHaveValue('Chiya Ghar');
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chiya Ghar', tiktok: 'chiya.ghar', source: 'tiktok' })
    );
  });

  it('files an Instagram link from the social field under Instagram', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('Business name'), 'Glow Med Spa');
    fireEvent.change(screen.getByLabelText('Social media link'), { target: { value: 'https://www.instagram.com/glow.medspa/?igsh=x' } });
    expect(screen.getByText('Saved as Instagram @glow.medspa.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ instagram: 'glow.medspa', source: 'instagram' }));
    expect(onSave.mock.calls[0][0].social).toBeUndefined();
  });

  it('keeps any other profile link as it is', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('Client name'), 'Sarah Lee');
    fireEvent.change(screen.getByLabelText('Social media link'), { target: { value: 'linkedin.com/in/sarahlee' } });
    expect(screen.getByText('Saved as a LinkedIn link.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ social: 'linkedin.com/in/sarahlee', source: 'other' }));
  });

  it('shows a profile link pasted into the name in the social field too', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'https://www.tiktok.com/@chiya.ghar' } });
    expect(screen.getByLabelText('Social media link')).toHaveValue('https://www.tiktok.com/@chiya.ghar');
  });

  it('warns about a business that is already a lead, and opens it', async () => {
    const { onOpenLead } = setup();
    await userEvent.type(screen.getByLabelText('Business name'), 'Momo House');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Denied');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenLead).toHaveBeenCalledWith('momo');
  });

  it('asks why when a lead is denied, and does not offer Onboarded', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Business name'), 'Cafe One');
    await userEvent.click(screen.getByLabelText('Status of Cafe One'));
    expect(screen.queryByRole('menuitemradio', { name: 'Onboarded' })).toBeNull();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Denied' }));
    expect(screen.getByLabelText('Why not')).toHaveValue('not-interested');
  });

  describe('editing', () => {
    const OLD: Lead = {
      ...MOMO, id: 'old', name: 'Bakery Ktm', status: 'approached', lostReason: undefined,
      phone: '01-5523344', instagram: 'bakery.ktm',
    };

    it('keeps an old number as saved unless it is edited', async () => {
      const { onSave } = setup({ lead: OLD, leads: [OLD] });
      expect(screen.getByLabelText('Phone / WhatsApp')).toHaveValue('01-5523344');
      await userEvent.type(screen.getByLabelText('Notes'), 'Called.');
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ phone: '01-5523344', instagram: 'bakery.ktm', note: 'Called.' }));
    });

    it('starts the social field at the lead\'s profile and leaves it alone if untouched', async () => {
      const { onSave } = setup({ lead: OLD, leads: [OLD] });
      expect(screen.getByLabelText('Social media link')).toHaveValue('https://www.instagram.com/bakery.ktm');
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ instagram: 'bakery.ktm' }));
    });

    it('shows a client-only lead with an empty business name', () => {
      const person: Lead = { ...OLD, name: 'John Carter', contactName: 'John Carter' };
      setup({ lead: person, leads: [person] });
      expect(screen.getByLabelText('Client name')).toHaveValue('John Carter');
      expect(screen.getByLabelText('Business name')).toHaveValue('');
    });

    it('folds the rest away, still editable', async () => {
      const { onSave } = setup({ lead: OLD, leads: [OLD] });
      await userEvent.click(screen.getByRole('button', { name: /Social profiles, follow-up and more/ }));
      fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: 'https://www.tiktok.com/@bakery.ktm' } });
      expect(screen.getByLabelText('TikTok')).toHaveValue('bakery.ktm');
      await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ followUpOn: '2026-11-09', tiktok: 'bakery.ktm' }));
    });
  });
});
