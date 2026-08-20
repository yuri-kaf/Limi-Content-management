import { buildToday, slotLabel, todayTotal } from './today';
import { Client, ContentItem } from './types';

const NOW = new Date('2026-08-20T12:00:00Z').getTime();
const DAY = 86_400_000;

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 't', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(id: string, content: ContentItem[]): Client {
  return { id, name: id.toUpperCase(), about: '', content, createdAt: 1 };
}

describe('buildToday', () => {
  it('finds work blocked on the client', () => {
    const g = buildToday([client('a', [
      item({ id: 'wait', status: 'review', clientReview: 'pending' }),
      item({ id: 'decided', status: 'review', clientReview: 'approved' }),
      item({ id: 'elsewhere', status: 'editing', clientReview: 'pending' }),
    ])], NOW);
    expect(g.waitingOnClient.map((e) => e.item.id)).toEqual(['wait']);
  });

  it('finds work blocked on us, ignoring anything already posted', () => {
    const g = buildToday([client('a', [
      item({ id: 'rework', clientReview: 'declined', status: 'editing' }),
      item({ id: 'done', clientReview: 'declined', status: 'posted' }),
    ])], NOW);
    expect(g.needsRework.map((e) => e.item.id)).toEqual(['rework']);
  });

  it('puts overdue ahead of upcoming in goingOutSoon', () => {
    const g = buildToday([client('a', [
      item({ id: 'soon', status: 'to-post', scheduledAt: NOW + 3 * DAY }),
      item({ id: 'overdue', status: 'to-post', scheduledAt: NOW - 2 * DAY }),
      item({ id: 'later', status: 'to-post', scheduledAt: NOW + 30 * DAY }),
      item({ id: 'published', status: 'posted', scheduledAt: NOW - DAY }),
    ])], NOW);
    expect(g.goingOutSoon.map((e) => e.item.id)).toEqual(['overdue', 'soon']);
  });

  it('finds approved work with no slot booked', () => {
    const g = buildToday([client('a', [
      item({ id: 'stalled', clientReview: 'approved', status: 'to-post' }),
      item({ id: 'booked', clientReview: 'approved', status: 'to-post', scheduledAt: NOW + DAY }),
      item({ id: 'zero', clientReview: 'approved', status: 'to-post', scheduledAt: 0 }),
      item({ id: 'gone', clientReview: 'approved', status: 'posted' }),
    ])], NOW);
    expect(g.readyToSchedule.map((e) => e.item.id).sort()).toEqual(['stalled', 'zero']);
  });

  it('carries the client each item belongs to', () => {
    const g = buildToday([
      client('acme', [item({ id: 'x', status: 'review', clientReview: 'pending' })]),
      client('bolt', [item({ id: 'y', status: 'review', clientReview: 'pending' })]),
    ], NOW);
    expect(g.waitingOnClient.map((e) => `${e.clientName}:${e.item.id}`)).toEqual(['ACME:x', 'BOLT:y']);
  });

  it('is empty for an empty workspace', () => {
    const g = buildToday([], NOW);
    expect(todayTotal(g)).toBe(0);
  });

  it('tolerates a client with no content array', () => {
    const g = buildToday([{ id: 'a', name: 'A', about: '', createdAt: 1 } as Client], NOW);
    expect(todayTotal(g)).toBe(0);
  });
});

describe('slotLabel', () => {
  const noon = new Date(2026, 7, 20, 12, 0, 0).getTime();
  const day = (n: number) => new Date(2026, 7, 20 + n, 12, 0, 0).getTime();

  it('has nothing to say about an unscheduled item', () => {
    expect(slotLabel(undefined, noon)).toBeNull();
    expect(slotLabel(0, noon)).toBeNull();
  });

  it('names today, tomorrow and yesterday', () => {
    expect(slotLabel(day(0), noon)).toEqual({ text: 'today', late: false });
    expect(slotLabel(day(1), noon)).toEqual({ text: 'tomorrow', late: false });
    expect(slotLabel(day(-1), noon)).toEqual({ text: 'yesterday', late: true });
  });

  it('counts whole days across a midnight boundary, not elapsed hours', () => {
    const lateTonight = new Date(2026, 7, 20, 23, 0, 0).getTime();
    const earlyTomorrow = new Date(2026, 7, 21, 1, 0, 0).getTime();
    expect(slotLabel(earlyTomorrow, lateTonight)).toEqual({ text: 'tomorrow', late: false });
  });

  it('steps up from days to weeks to months', () => {
    expect(slotLabel(day(3), noon)!.text).toBe('in 3 days');
    expect(slotLabel(day(14), noon)!.text).toBe('in 2 weeks');
    expect(slotLabel(day(60), noon)!.text).toBe('in 2 months');
  });

  it('marks anything in the past as late and says by how much', () => {
    expect(slotLabel(day(-3), noon)).toEqual({ text: '3 days late', late: true });
    expect(slotLabel(day(-14), noon)).toEqual({ text: '2 weeks late', late: true });
    expect(slotLabel(day(-60), noon)).toEqual({ text: '2 months late', late: true });
  });
});
