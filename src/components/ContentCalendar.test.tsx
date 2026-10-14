import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentCalendar from './ContentCalendar';
import { ContentItem } from '../types';

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'to-post', createdAt: 1,
    uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

// Built from local parts, so "the 12th of this month" is the same day in
// every time zone the suite runs in.
const now = new Date();
const thisMonth = (day: number) => new Date(now.getFullYear(), now.getMonth(), day, 10).getTime();
const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

describe('ContentCalendar', () => {
  it("puts a scheduled post on its day in its stage's colour, and opens it", async () => {
    const onItemClick = vi.fn();
    const post = item({ id: 'a', title: 'Laptop deals story', scheduledAt: thisMonth(12) });
    render(
      <ContentCalendar content={[post]} canAdd={false} onDayClick={vi.fn()} onItemClick={onItemClick} />
    );
    const chip = screen.getByRole('button', { name: 'Laptop deals story' });
    expect(chip.style.getPropertyValue('--sc-tint')).toBe('#faefcc');
    await userEvent.click(chip);
    expect(onItemClick).toHaveBeenCalledWith(post);
  });

  it('names its month buttons and moves between months', async () => {
    render(<ContentCalendar content={[]} canAdd={false} onDayClick={vi.fn()} onItemClick={vi.fn()} />);
    expect(screen.getByText(monthLabel(now))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(
      screen.getByText(monthLabel(new Date(now.getFullYear(), now.getMonth() + 1, 1)))
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText(monthLabel(now))).toBeInTheDocument();
  });
});
