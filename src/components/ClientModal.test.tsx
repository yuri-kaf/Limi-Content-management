import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientModal from './ClientModal';

describe('ClientModal', () => {
  it('saves the chosen folder colour with a new client', async () => {
    const onSave = vi.fn();
    render(<ClientModal onClose={vi.fn()} onSave={onSave} />);
    await userEvent.type(screen.getByPlaceholderText('Client name'), 'Acme');
    await userEvent.click(screen.getByRole('radio', { name: 'Purple' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Acme', imageUrl: undefined, about: '', color: 'purple',
    });
  });

  it("starts from the client's current colour when editing", () => {
    render(
      <ClientModal
        client={{ id: 'a', name: 'Acme', about: '', color: 'teal', content: [], businesses: [], createdAt: 1 }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true');
  });

  it('previews the folder in the colour being chosen', async () => {
    render(<ClientModal onClose={vi.fn()} onSave={vi.fn()} />);
    expect(document.querySelector('[data-folder-color="blue"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
    expect(document.querySelector('[data-folder-color="pink"]')).not.toBeNull();
    expect(document.querySelector('[data-folder-color="blue"]')).toBeNull();
  });

  it('previews the name and the logo on the folder as they are typed', async () => {
    render(<ClientModal onClose={vi.fn()} onSave={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Client name'), 'acme');
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    // The spaces around a pasted URL are not part of it, as when it is saved.
    await userEvent.type(screen.getByPlaceholderText('https://...'), ' https://x.test/logo.png ');
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://x.test/logo.png');
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});
