import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../contexts/ThemeContext';
import StageTabs, { StageTab } from './StageTabs';
import { STAGES } from '../utils';

const tabs: StageTab[] = [
  { id: 'editing', label: 'Editing', count: 16 },
  { id: 'review', label: 'Review', count: 0 },
  { id: 'to-post', label: 'To Post', count: 1 },
  { id: 'posted', label: 'Posted', count: 13 },
];

function setup(active: StageTab['id'] = 'editing', stored?: 'light' | 'dark') {
  localStorage.clear();
  if (stored) localStorage.setItem('limi_theme', stored);
  const onChange = vi.fn();
  render(
    <ThemeProvider>
      <StageTabs tabs={tabs} active={active} onChange={onChange} />
    </ThemeProvider>
  );
  return onChange;
}

describe('StageTabs', () => {
  it('shows every stage and its count at once — the thing a scrolled row hid', () => {
    setup();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    for (const tab of tabs) {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
      expect(screen.getByText(String(tab.count))).toBeInTheDocument();
    }
  });

  it('marks exactly one tab selected', () => {
    setup('to-post');
    const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('To Post');
  });

  it('reports the stage that was tapped', async () => {
    const onChange = setup();
    await userEvent.click(screen.getByText('Posted'));
    expect(onChange).toHaveBeenCalledWith('posted');
  });

  it('underlines the active tab in that stage own colour, per theme', () => {
    const review = STAGES.find((s) => s.id === 'review')!;
    setup('review');
    const tab = screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')!;
    expect(tab).toHaveStyle({ borderBottomColor: review.text });
  });

  it('uses the dark pair when the theme is dark', () => {
    const review = STAGES.find((s) => s.id === 'review')!;
    setup('review', 'dark');
    const tab = screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')!;
    expect(tab).toHaveStyle({ borderBottomColor: review.textDark });
  });

  it('renders three tabs for a client, who never sees Editing', () => {
    localStorage.clear();
    render(
      <ThemeProvider>
        <StageTabs tabs={tabs.slice(1)} active="review" onChange={vi.fn()} />
      </ThemeProvider>
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
