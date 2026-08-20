import { ContentFilters, NO_FILTERS, activeFilterCount, filterContent } from './filters';
import { ContentItem } from './types';

// A fixed "now" so these never depend on the clock.
const NOW = new Date('2026-08-20T12:00:00Z').getTime();
const DAY = 86_400_000;

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 't', driveLink: '', driveFileId: '', status: 'to-post',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending',
    mediaType: 'video', platforms: [], ...over,
  } as ContentItem;
}

const f = (over: Partial<ContentFilters> = {}): ContentFilters => ({ ...NO_FILTERS, ...over });

describe('filterContent — date window', () => {
  const overdue = item({ id: 'overdue', scheduledAt: NOW - 2 * DAY });
  const postedOverdue = item({ id: 'postedOverdue', scheduledAt: NOW - 2 * DAY, status: 'posted' });
  const soon = item({ id: 'soon', scheduledAt: NOW + 3 * DAY });
  const later = item({ id: 'later', scheduledAt: NOW + 20 * DAY });
  const none = item({ id: 'none' });
  const all = [overdue, postedOverdue, soon, later, none];

  it('returns everything when the window is all', () => {
    expect(filterContent(all, f(), NOW)).toHaveLength(5);
  });

  it('overdue excludes anything already posted', () => {
    expect(filterContent(all, f({ date: 'overdue' }), NOW).map((i) => i.id)).toEqual(['overdue']);
  });

  it('next7 covers the coming week only', () => {
    expect(filterContent(all, f({ date: 'next7' }), NOW).map((i) => i.id)).toEqual(['soon']);
  });

  it('month reaches 31 days out', () => {
    expect(filterContent(all, f({ date: 'month' }), NOW).map((i) => i.id)).toEqual(['soon', 'later']);
  });

  it('unscheduled finds items with no slot', () => {
    expect(filterContent(all, f({ date: 'unscheduled' }), NOW).map((i) => i.id)).toEqual(['none']);
  });

  it('treats a zero timestamp as unscheduled', () => {
    expect(filterContent([item({ id: 'z', scheduledAt: 0 })], f({ date: 'unscheduled' }), NOW))
      .toHaveLength(1);
  });
});

describe('filterContent — media type', () => {
  const items = [item({ id: 'v', mediaType: 'video' }), item({ id: 'g', mediaType: 'graphic' })];

  it('filters to graphics', () => {
    expect(filterContent(items, f({ mediaType: 'graphic' }), NOW).map((i) => i.id)).toEqual(['g']);
  });

  it('counts a legacy item with no mediaType as a video', () => {
    const legacy = item({ id: 'legacy', mediaType: undefined });
    expect(filterContent([legacy], f({ mediaType: 'video' }), NOW)).toHaveLength(1);
    expect(filterContent([legacy], f({ mediaType: 'graphic' }), NOW)).toHaveLength(0);
  });
});

describe('filterContent — platforms', () => {
  const ig = item({ id: 'ig', platforms: ['instagram'] });
  const tt = item({ id: 'tt', platforms: ['tiktok'] });
  const both = item({ id: 'both', platforms: ['instagram', 'tiktok'] });
  const nonePlat = item({ id: 'none', platforms: [] });
  const all = [ig, tt, both, nonePlat];

  it('an empty selection means any platform', () => {
    expect(filterContent(all, f(), NOW)).toHaveLength(4);
  });

  it('matches an item carrying any of the selected platforms', () => {
    expect(filterContent(all, f({ platforms: ['instagram'] }), NOW).map((i) => i.id))
      .toEqual(['ig', 'both']);
  });

  it('selecting two platforms is a union, not an intersection', () => {
    expect(filterContent(all, f({ platforms: ['instagram', 'tiktok'] }), NOW).map((i) => i.id))
      .toEqual(['ig', 'tt', 'both']);
  });
});

describe('filterContent — combined', () => {
  it('applies every dimension together', () => {
    const items = [
      item({ id: 'keep', mediaType: 'graphic', platforms: ['instagram'], scheduledAt: NOW + DAY }),
      item({ id: 'wrongType', mediaType: 'video', platforms: ['instagram'], scheduledAt: NOW + DAY }),
      item({ id: 'wrongPlat', mediaType: 'graphic', platforms: ['tiktok'], scheduledAt: NOW + DAY }),
      item({ id: 'wrongDate', mediaType: 'graphic', platforms: ['instagram'], scheduledAt: NOW + 40 * DAY }),
    ];
    const result = filterContent(items, f({ date: 'next7', mediaType: 'graphic', platforms: ['instagram'] }), NOW);
    expect(result.map((i) => i.id)).toEqual(['keep']);
  });
});

describe('activeFilterCount', () => {
  it('is 0 for no filters', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  it('counts each engaged dimension once', () => {
    expect(activeFilterCount(f({ date: 'overdue' }))).toBe(1);
    expect(activeFilterCount(f({ date: 'overdue', mediaType: 'graphic' }))).toBe(2);
    expect(activeFilterCount(f({ platforms: ['instagram', 'tiktok'] }))).toBe(1);
    expect(activeFilterCount(f({ date: 'next7', mediaType: 'video', platforms: ['tiktok'] }))).toBe(3);
  });
});
