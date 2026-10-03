import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BusinessModal from './BusinessModal';
import { Business } from '../types';

const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('BusinessModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a business with the chosen colour', async () => {
    const onSave = vi.fn();
    render(<BusinessModal onClose={vi.fn()} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Bakery');
    await userEvent.click(screen.getByRole('radio', { name: 'Orange' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add business' }));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Bakery', color: 'orange', logoUrl: undefined, about: '',
    });
  });

  it('explains why a business cannot be deleted, and will not delete it', async () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(
      <BusinessModal
        business={CAFE}
        deleteBlocker="It still holds 2 content items."
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />
    );
    const button = screen.getByRole('button', { name: /Delete business/ });
    // Still reachable, so the reason can be: aria-disabled, not disabled.
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('It still holds 2 content items.');
    await userEvent.click(button);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('stays open with what was typed when the save fails', async () => {
    const onClose = vi.fn();
    render(<BusinessModal onClose={onClose} onSave={async () => false} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Bakery');
    await userEvent.click(screen.getByRole('button', { name: 'Add business' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('Bakery');
  });

  it('deletes after confirmation when nothing blocks it', async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BusinessModal business={CAFE} onClose={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /Delete business/ }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('offers no delete while creating', () => {
    render(<BusinessModal onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Delete business/ })).not.toBeInTheDocument();
  });
});
