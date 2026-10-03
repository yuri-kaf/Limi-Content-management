import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BusinessModal from './BusinessModal';
import { Business } from '../types';

const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('BusinessModal', () => {
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

  it('explains why a business cannot be deleted, and disables the action', () => {
    render(
      <BusinessModal
        business={CAFE}
        deleteBlocker="It still holds 2 content items."
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Delete business/ })).toBeDisabled();
    expect(screen.getByText('It still holds 2 content items.')).toBeInTheDocument();
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
