import { ContentItem, MediaType, Platform } from './types';
import { mediaTypeOf } from './utils';

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

const DAY = 86_400_000;

// `now` is a parameter rather than a Date.now() call so the behaviour is
// testable and a filtered view cannot shift under you mid-render.
function matchesDate(item: ContentItem, window: DateWindow, now: number): boolean {
  const at = item.scheduledAt ?? 0;
  const scheduled = at > 0;

  switch (window) {
    case 'all':
      return true;
    case 'unscheduled':
      return !scheduled;
    // Something already posted cannot be overdue, however old its slot is.
    case 'overdue':
      return scheduled && at < now && item.status !== 'posted';
    case 'next7':
      return scheduled && at >= now && at <= now + 7 * DAY;
    case 'month':
      return scheduled && at >= now && at <= now + 31 * DAY;
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
