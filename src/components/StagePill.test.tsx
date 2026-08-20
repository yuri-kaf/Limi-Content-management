import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import StagePill from './StagePill';
import { STAGES } from '../utils';

function renderPill(ui: React.ReactElement, stored?: 'light' | 'dark') {
  localStorage.clear();
  if (stored) localStorage.setItem('limi_theme', stored);
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const review = STAGES.find((s) => s.id === 'review')!;

describe('StagePill', () => {
  it('renders the stage label', () => {
    renderPill(<StagePill status="review" />);
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders a count when given one', () => {
    renderPill(<StagePill status="to-post" count={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('To Post')).toBeInTheDocument();
  });

  it('uses the light pair by default', () => {
    renderPill(<StagePill status="review" />);
    const pill = screen.getByText('Review');
    expect(pill).toHaveStyle({ color: review.text });
  });

  it('uses the dark pair when the theme is dark', () => {
    renderPill(<StagePill status="review" />, 'dark');
    const pill = screen.getByText('Review');
    expect(pill).toHaveStyle({ color: review.textDark });
  });

  it('renders nothing for an unknown status', () => {
    const { container } = renderPill(<StagePill status={'nope' as never} />);
    expect(container.textContent).toBe('');
  });
});
