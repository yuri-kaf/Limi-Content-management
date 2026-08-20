import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>theme:{theme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light when nothing is stored', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('honours a stored dark choice', () => {
    localStorage.setItem('limi_theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists a toggle', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(localStorage.getItem('limi_theme')).toBe('dark');
  });

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem('limi_theme', 'banana');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
  });
});
