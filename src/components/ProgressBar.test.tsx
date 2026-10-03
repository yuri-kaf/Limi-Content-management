import { render, screen } from '@testing-library/react';
import ProgressBar from './ProgressBar';

describe('ProgressBar', () => {
  it('reports its value as a percentage under its label', () => {
    render(<ProgressBar value={2 / 7} color="green" label="2 of 7 posted" />);
    expect(screen.getByRole('progressbar', { name: '2 of 7 posted' }))
      .toHaveAttribute('aria-valuenow', '29');
  });

  it('hides a decorative bar from screen readers', () => {
    const { container } = render(
      <ProgressBar value={0.5} color="green" label="1 of 2 posted" decorative />
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('clamps values outside 0 to 1, and treats NaN as empty', () => {
    const { rerender } = render(<ProgressBar value={1.4} color="green" label="p" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={NaN} color="green" label="p" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});
