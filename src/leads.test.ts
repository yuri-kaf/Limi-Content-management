import { contrastRatio } from './color';
import {
  LEAD_STATUSES, addDays, addMonths, findDuplicates, followUpLabel, followUpState, handleOf,
  inView, leadsDue, matchesQuery, nameFromHandle, parseProfileInput, phoneKey, primaryHandle,
  profileUrl, sortLeads, whatsappUrl,
} from './leads';
import { Lead } from './types';

const TODAY = '2026-11-02';

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: over.id ?? 'l1',
    name: 'Cafe Ktm',
    source: 'instagram',
    status: 'approached',
    note: '',
    ownerEmail: 'ichchha@limi.test',
    ownerName: 'Ichchha',
    createdAt: 1,
    updatedAt: 1,
    statusAt: 1,
    ...over,
  };
}

describe('handleOf', () => {
  it.each([
    ['@Cafe.Ktm', 'cafe.ktm'],
    ['cafe.ktm', 'cafe.ktm'],
    ['https://www.instagram.com/cafe.ktm/?igsh=abc', 'cafe.ktm'],
    ['instagram.com/cafe.ktm', 'cafe.ktm'],
    ['https://www.tiktok.com/@cafe.ktm?lang=en', 'cafe.ktm'],
    ['https://www.facebook.com/profile.php?id=1000123', '1000123'],
    ['', ''],
  ])('%s → %s', (raw, handle) => {
    expect(handleOf(raw)).toBe(handle);
  });
});

describe('parseProfileInput', () => {
  it('reads the platform from a pasted profile link', () => {
    expect(parseProfileInput('https://www.tiktok.com/@momo.house')).toEqual({ field: 'tiktok', handle: 'momo.house' });
    expect(parseProfileInput('https://instagram.com/momo.house/')).toEqual({ field: 'instagram', handle: 'momo.house' });
    expect(parseProfileInput('fb.com/momohouse')).toEqual({ field: 'facebook', handle: 'momohouse' });
  });

  it('takes a bare handle as Instagram', () => {
    expect(parseProfileInput('@momo.house')).toEqual({ field: 'instagram', handle: 'momo.house' });
  });

  it('ignores text that is not a profile', () => {
    expect(parseProfileInput('Momo House Thamel')).toBeNull();
    expect(parseProfileInput('https://example.com/menu')).toBeNull();
  });
});

describe('links', () => {
  it('builds a profile link from a handle and keeps a URL as given', () => {
    expect(profileUrl('instagram', '@cafe.ktm')).toBe('https://www.instagram.com/cafe.ktm');
    expect(profileUrl('tiktok', 'cafe.ktm')).toBe('https://www.tiktok.com/@cafe.ktm');
    expect(profileUrl('instagram', 'instagram.com/x')).toBe('https://instagram.com/x');
  });

  it('adds Nepal\'s country code to a bare mobile number for WhatsApp', () => {
    expect(whatsappUrl('984-123 4567')).toBe('https://wa.me/9779841234567');
    expect(whatsappUrl('+977 9841234567')).toBe('https://wa.me/9779841234567');
    expect(whatsappUrl('')).toBe('');
  });

  it('matches phone numbers however they were typed', () => {
    expect(phoneKey('+977 984-1234567')).toBe(phoneKey('9841234567'));
  });

  it('names a business from its handle', () => {
    expect(nameFromHandle('cafe.ktm_official')).toBe('Cafe Ktm Official');
  });

  it('shows the handle of the platform the lead came from', () => {
    expect(primaryHandle(lead({ source: 'tiktok', instagram: 'a', tiktok: 'b' }))).toEqual({ field: 'tiktok', handle: 'b' });
    expect(primaryHandle(lead({ source: 'referral', tiktok: 'b' }))).toEqual({ field: 'tiktok', handle: 'b' });
    expect(primaryHandle(lead())).toBeNull();
  });
});

describe('findDuplicates', () => {
  const existing = [
    lead({ id: 'a', name: 'Momo House', instagram: 'https://instagram.com/momo.house', status: 'denied' }),
    lead({ id: 'b', name: 'Tea Room', phone: '+977 9841234567' }),
    lead({ id: 'c', name: 'Bakery', email: 'Hi@Bakery.np' }),
  ];

  it('finds the same handle typed differently', () => {
    const found = findDuplicates({ instagram: '@Momo.House' }, existing);
    expect(found.map((d) => [d.lead.id, d.on])).toEqual([['a', 'Instagram @momo.house']]);
  });

  it('finds the same phone, email and name', () => {
    expect(findDuplicates({ phone: '9841234567' }, existing)[0].lead.id).toBe('b');
    expect(findDuplicates({ email: 'hi@bakery.np ' }, existing)[0].lead.id).toBe('c');
    expect(findDuplicates({ name: ' tea  room' }, existing)[0].on).toBe('name');
  });

  it('skips the lead being edited and short fragments', () => {
    expect(findDuplicates({ name: 'Tea Room' }, existing, 'b')).toEqual([]);
    expect(findDuplicates({ phone: '98' }, existing)).toEqual([]);
  });
});

describe('days', () => {
  it('adds days across a month end', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 7)).toBe('2027-01-07');
  });

  it('clamps a month later to the last day', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2026-11-02', 3)).toBe('2027-02-02');
  });

  it('labels follow-up days relative to today', () => {
    expect(followUpLabel(TODAY, TODAY)).toBe('Today');
    expect(followUpLabel('2026-11-03', TODAY)).toBe('Tomorrow');
    expect(followUpLabel('2026-11-01', TODAY)).toBe('Yesterday');
    expect(followUpLabel('2026-10-28', TODAY)).toBe('5 days late');
    expect(followUpLabel('2026-11-20', TODAY)).toBe('20 Nov');
  });
});

describe('follow-ups', () => {
  it('is due when today or late, and never on a closed lead', () => {
    expect(followUpState(lead({ followUpOn: '2026-11-01' }), TODAY)).toBe('overdue');
    expect(followUpState(lead({ followUpOn: TODAY }), TODAY)).toBe('today');
    expect(followUpState(lead({ followUpOn: '2026-11-09' }), TODAY)).toBe('upcoming');
    expect(followUpState(lead({ followUpOn: '2026-11-01', status: 'denied' }), TODAY)).toBeNull();
    expect(followUpState(lead(), TODAY)).toBeNull();
  });

  it('counts what is due', () => {
    expect(leadsDue([
      lead({ followUpOn: TODAY }),
      lead({ followUpOn: '2026-10-01', status: 'later' }),
      lead({ followUpOn: '2026-12-01' }),
      lead({ followUpOn: '2026-10-01', status: 'onboarded' }),
    ], TODAY)).toBe(2);
  });
});

describe('views', () => {
  const all = [
    lead({ id: 'new', status: 'new' }),
    lead({ id: 'road', status: 'roadblock' }),
    lead({ id: 'later', status: 'later', followUpOn: TODAY }),
    lead({ id: 'quiet', status: 'no-reply' }),
    lead({ id: 'won', status: 'onboarded' }),
    lead({ id: 'no', status: 'denied' }),
  ];
  const ids = (view: Parameters<typeof inView>[1]) => all.filter((l) => inView(l, view, TODAY)).map((l) => l.id);

  it('splits leads into tabs without losing any', () => {
    expect(ids('active')).toEqual(['new', 'road']);
    expect(ids('parked')).toEqual(['later', 'quiet']);
    expect(ids('follow-up')).toEqual(['later']);
    expect(ids('onboarded')).toEqual(['won']);
    expect(ids('denied')).toEqual(['no']);
    expect(ids('all')).toHaveLength(all.length);
  });

  it('searches names, handles, notes and phone digits', () => {
    const l = lead({ instagram: 'instagram.com/momo.house', note: 'Owner wants reels', phone: '9841234567' });
    expect(matchesQuery(l, '@momo')).toBe(true);
    expect(matchesQuery(l, 'reels')).toBe(true);
    expect(matchesQuery(l, '1234')).toBe(true);
    expect(matchesQuery(l, 'pizza')).toBe(false);
  });
});

describe('sortLeads', () => {
  it('puts the best leads first, then what is due, then the latest touched', () => {
    const list = [
      lead({ id: 'unrated', updatedAt: 9 }),
      lead({ id: 'two-old', potential: 2, updatedAt: 1 }),
      lead({ id: 'two-due', potential: 2, updatedAt: 0, followUpOn: TODAY }),
      lead({ id: 'three', potential: 3, updatedAt: 0 }),
      lead({ id: 'two-new', potential: 2, updatedAt: 5 }),
    ];
    expect(sortLeads(list, 'best', TODAY).map((l) => l.id)).toEqual([
      'three', 'two-due', 'two-new', 'two-old', 'unrated',
    ]);
  });

  it('sorts by follow-up date with undated last', () => {
    const list = [
      lead({ id: 'none' }),
      lead({ id: 'late', followUpOn: '2026-12-01' }),
      lead({ id: 'soon', followUpOn: '2026-11-05' }),
    ];
    expect(sortLeads(list, 'follow-up', TODAY).map((l) => l.id)).toEqual(['soon', 'late', 'none']);
  });
});

describe('lead status pills meet WCAG AA', () => {
  it('covers every status once', () => {
    expect(new Set(LEAD_STATUSES.map((s) => s.id)).size).toBe(9);
  });

  it.each(LEAD_STATUSES)('$label reads in both themes', (s) => {
    expect(contrastRatio(s.text, s.tint)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s.textDark, s.tintDark)).toBeGreaterThanOrEqual(4.5);
  });
});
