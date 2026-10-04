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

  it('draws the emblem at 40px, and not at 39', () => {
    const { rerender } = render(<FolderIcon label="momoland" size={40} />);
    expect(screen.getByText('M')).toBeInTheDocument();
    rerender(<FolderIcon label="momoland" size={39} />);
    expect(screen.queryByText('M')).not.toBeInTheDocument();
  });

  it.each([
    ['@momo', 'M'],
    ['🎉 momo', 'M'],
    ['7 Eleven', '7'],
  ])('takes the initial of %s from its first letter or digit', (label, initial) => {
    // The first character would be "@", or half of an emoji.
    render(<FolderIcon label={label} size={88} />);
    expect(screen.getByText(initial)).toBeInTheDocument();
  });

  it('draws no emblem for a name with no letter or digit in it', () => {
    const { container } = render(<FolderIcon label="🎉@#" size={88} />);
    expect(container.textContent).toBe('');
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

  it('tries a corrected logo URL, but not the one that failed', () => {
    // Fixing a broken logo is an edit, and an edit re-renders the folder rather
    // than remounting it, so a failure has to belong to the URL that failed.
    const { container, rerender } = render(
      <FolderIcon label="Momoland" imageUrl="https://x.test/broken.png" size={88} />
    );
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('M')).toBeInTheDocument();

    // The same URL again, as when any edit re-renders the grid, is not retried.
    rerender(<FolderIcon label="Momoland" imageUrl="https://x.test/broken.png" size={88} />);
    expect(container.querySelector('img')).toBeNull();

    rerender(<FolderIcon label="Momoland" imageUrl="https://x.test/fixed.png" size={88} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x.test/fixed.png');
    expect(screen.queryByText('M')).not.toBeInTheDocument();
  });

  it('keeps a logo off a folder too small to show it', () => {
    const { container } = render(
      <FolderIcon label="Momoland" imageUrl="https://x.test/logo.png" size={18} />
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('gives a small folder a bigger logo, as a share of its width', () => {
    // At 40px the usual 36% is 14px, which is hard to read.
    const { container, rerender } = render(
      <FolderIcon label="Momoland" imageUrl="https://x.test/logo.png" size={40} />
    );
    expect(container.querySelector('img')!.style.width).toBe('20px');
    rerender(<FolderIcon label="Momoland" imageUrl="https://x.test/logo.png" size={88} />);
    expect(container.querySelector('img')!.style.width).toBe('32px');
  });

  it('gives a small folder a bigger initial too', () => {
    const { rerender } = render(<FolderIcon label="Momoland" size={40} />);
    expect(screen.getByText('M').style.fontSize).toBe('14px');
    rerender(<FolderIcon label="Momoland" size={88} />);
    expect(screen.getByText('M').style.fontSize).toBe('23px');
  });

  it('keeps the folder proportions', () => {
    const { container } = render(<FolderIcon size={88} />);
    const box = container.firstChild as HTMLElement;
    expect(box.style.width).toBe('88px');
    expect(box.style.height).toBe('72px');
  });
});
