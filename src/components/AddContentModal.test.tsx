import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddContentModal from './AddContentModal';
import { ContentItem } from '../types';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 'Launch reel', driveLink: 'https://example.com/reel.mp4', driveFileId: '',
    status: 'to-post', createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  };
}

describe('AddContentModal', () => {
  const scheduledAt = new Date(2026, 9, 3, 1, 0).getTime();

  it('shows an early-morning post on its local day', () => {
    // Nepal is UTC+5:45, so 01:00 there is still the day before in UTC: the
    // hour a UTC-formatted date got wrong. vite.config.ts pins the zone.
    expect(new Date(scheduledAt).toISOString()).toBe('2026-10-02T19:15:00.000Z');

    const { container } = render(
      <AddContentModal
        defaultStatus="to-post"
        existingItem={item({ scheduledAt })}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(container.querySelector('input[type="date"]')).toHaveValue('2026-10-03');
  });

  it('saves an untouched post at the time it already had', async () => {
    const onSubmit = vi.fn();
    render(
      <AddContentModal
        defaultStatus="to-post"
        existingItem={item({ scheduledAt })}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt }));
  });
});
