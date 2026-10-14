import { ContentItem, MediaType, Platform } from './types';
import { mediaTypeOf } from './utils';
import { isDueWithin, isLate } from './today';

export type DateWindow = 'all' | 'overdue' | 'next7' | 'month' | 'unscheduled';

export interface ContentFilters {
  date: DateWindow;
  mediaType: MediaType | 'all';
  /** Empty means any platform, not none. */
  platforms: Platform[];
}

export const NO_FILTERS: ContentFilters = { date: 'all', mediaType: 'all', platforms: [] };

export const DATE_WINDOWS: { id: DateWindow; label: string }[] = [
  { id: 'all', label: 'Any date' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'next7', label: 'Next 7 days' },
  { id: 'month', label: 'Next month' },
  { id: 'unscheduled', label: 'Unscheduled' },
];

// `now` is a parameter rather than a Date.now() call so the behaviour is
// testable and a filtered view cannot shift under you mid-render.
function matchesDate(item: ContentItem, window: DateWindow, now: number): boolean {
  const scheduled = (item.scheduledAt ?? 0) > 0;

  switch (window) {
    case 'all':
      return true;
    case 'unscheduled':
      return !scheduled;
    // The queue's rule: an earlier day, and not yet posted.
    case 'overdue':
      return isLate(item, now);
    // From the start of today, so a slot earlier today, not yet late, still
    // shows; isLate and isDueWithin between them cover every unposted slot.
    case 'next7':
      return isDueWithin(item, now, 7);
    case 'month':
      return isDueWithin(item, now, 31);
  }
}

export function filterContent(
  items: ContentItem[],
  filters: ContentFilters,
  now: number
): ContentItem[] {
  return items.filter((item) => {
    if (!matchesDate(item, filters.date, now)) return false;
    // mediaTypeOf treats a legacy item with no stored type as a video, which is
    // what it was before graphics existed.
    if (filters.mediaType !== 'all' && mediaTypeOf(item) !== filters.mediaType) return false;
    if (filters.platforms.length > 0) {
      const on = item.platforms ?? [];
      if (!filters.platforms.some((p) => on.includes(p))) return false;
    }
    return true;
  });
}

/** How many dimensions are engaged — for the badge on the filter button. */
export function activeFilterCount(filters: ContentFilters): number {
  let n = 0;
  if (filters.date !== 'all') n += 1;
  if (filters.mediaType !== 'all') n += 1;
  if (filters.platforms.length > 0) n += 1;
  return n;
}
