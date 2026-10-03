import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorSwatchPicker from './ColorSwatchPicker';

describe('ColorSwatchPicker', () => {
  it('offers every folder colour by name and marks the current one', () => {
    render(<ColorSwatchPicker value="pink" onChange={vi.fn()} label="Folder colour" />);
    expect(screen.getByRole('radiogroup', { name: 'Folder colour' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(screen.getByRole('radio', { name: 'Pink' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'false');
  });

  it('reports the colour that was picked', async () => {
    const onChange = vi.fn();
    render(<ColorSwatchPicker value="blue" onChange={onChange} label="Folder colour" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Teal' }));
    expect(onChange).toHaveBeenCalledWith('teal');
  });
});
