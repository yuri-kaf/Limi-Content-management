import { fireEvent, render, screen } from '@testing-library/react';
import FolderIcon from './FolderIcon';

const fills = (container: HTMLElement) =>
  [...container.querySelectorAll('path, rect')].map((el) => el.getAttribute('fill'));

describe('FolderIcon', () => {
  it('is decorative, because the name is always written beside it', () => {
    const { container } = render(<FolderIcon color="green" label="Momoland" size={88} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws in its folder colour, and in blue for an unknown one', () => {
    const { container, rerender } = render(<FolderIcon color="green" />);
    expect(container.firstChild).toHaveAttribute('data-folder-color', 'green');
    expect(fills(container)).toEqual(['#22c55e', '#76db9b']);
    rerender(<FolderIcon color="chartreuse" />);
    expect(container.firstChild).toHaveAttribute('data-folder-color', 'blue');
    expect(fills(container)).toEqual(['#3b82f6', '#85b2f9']);
  });

  it('embosses the initial only where there is room for it', () => {
    const { rerender } = render(<FolderIcon label="momoland" size={88} />);
    expect(screen.getByText('M')).toBeInTheDocument();
    rerender(<FolderIcon label="momoland" size={18} />);
    expect(screen.queryByText('M')).not.toBeInTheDocument();
  });

  it('shows the logo, and the initial if the logo fails to load', () => {
    const { container } = render(
      <FolderIcon label="Momoland" imageUrl="https://x.test/logo.png" size={88} />
    );
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://x.test/logo.png');
    expect(screen.queryByText('M')).not.toBeInTheDocument();
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('keeps a logo off a folder too small to show it', () => {
    const { container } = render(
      <FolderIcon label="Momoland" imageUrl="https://x.test/logo.png" size={18} />
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps the folder proportions', () => {
    const { container } = render(<FolderIcon size={88} />);
    const box = container.firstChild as HTMLElement;
    expect(box.style.width).toBe('88px');
    expect(box.style.height).toBe('72px');
  });
});
