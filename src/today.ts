import { Client, ContentItem } from './types';

export interface TodayEntry {
  clientId: string;
  clientName: string;
  /** So a row can be identified by the client's own mark, not only its name. */
  clientImageUrl?: string;
  item: ContentItem;
}

export interface TodayGroups {
  /** In Review and the client has not decided. Blocked on someone else. */
  waitingOnClient: TodayEntry[];
  /** Declined and not yet reposted. Blocked on us. */
  needsRework: TodayEntry[];
  /** Has a slot inside the next week, or a slot that has already passed. */
  goingOutSoon: TodayEntry[];
  /** Approved but with no slot booked — the quiet gap where work stalls. */
  readyToSchedule: TodayEntry[];
}

const DAY = 86_400_000;

function entries(clients: Client[]): TodayEntry[] {
  return clients.flatMap((c) =>
    (c.content ?? []).map((item) => ({
      clientId: c.id,
      clientName: c.name,
      clientImageUrl: c.imageUrl,
      item,
    }))
  );
}

// Groups are deliberately disjoint in intent but not enforced to be: an item can
// legitimately be both declined and overdue, and hiding one of those would be
// worse than showing it twice.
//
// "Recently decided" was considered and dropped: nothing on a content item
// records *when* a review decision was made, so it could not be computed
// honestly. readyToSchedule replaces it and is a real gap in the workflow —
// approved work with no slot booked simply stops moving.
export function buildToday(clients: Client[], now: number): TodayGroups {
  const all = entries(clients);
  const bySlot = (a: TodayEntry, b: TodayEntry) =>
    (a.item.scheduledAt ?? 0) - (b.item.scheduledAt ?? 0);

  return {
    waitingOnClient: all.filter(
      (e) => e.item.status === 'review' && e.item.clientReview === 'pending'
    ),
    needsRework: all.filter(
      (e) => e.item.clientReview === 'declined' && e.item.status !== 'posted'
    ),
    goingOutSoon: all
      .filter((e) => {
        const at = e.item.scheduledAt ?? 0;
        return at > 0 && at <= now + 7 * DAY && e.item.status !== 'posted';
      })
      .sort(bySlot),
    readyToSchedule: all.filter(
      (e) =>
        e.item.clientReview === 'approved' &&
        e.item.status !== 'posted' &&
        !(e.item.scheduledAt && e.item.scheduledAt > 0)
    ),
  };
}

export function todayTotal(groups: TodayGroups): number {
  return (
    groups.waitingOnClient.length +
    groups.needsRework.length +
    groups.goingOutSoon.length +
    groups.readyToSchedule.length
  );
}

// ─── Reading a slot ──────────────────────────────────────────────────────────

/**
 * A date in the terms the queue is actually read in. "Aug 19" in red says
 * something is wrong but not what or by how much; "1 day late" says both, and
 * "tomorrow" is instantly clearer than a date you have to compare against
 * today's yourself.
 *
 * Differences are counted in whole local days, so 11pm tonight to 1am tomorrow
 * is "tomorrow" rather than "in 0 days".
 */
export interface SlotLabel {
  text: string;
  late: boolean;
}

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export function slotLabel(scheduledAt: number | undefined, now: number): SlotLabel | null {
  if (!scheduledAt || scheduledAt <= 0) return null;

  const days = Math.round((startOfDay(scheduledAt) - startOfDay(now)) / DAY);

  if (days === 0) return { text: 'today', late: false };
  if (days === 1) return { text: 'tomorrow', late: false };
  if (days === -1) return { text: 'yesterday', late: true };

  if (days > 0) {
    if (days < 7) return { text: `in ${plural(days, 'day')}`, late: false };
    if (days < 31) return { text: `in ${plural(Math.round(days / 7), 'week')}`, late: false };
    return { text: `in ${plural(Math.round(days / 30), 'month')}`, late: false };
  }

  const late = -days;
  if (late < 7) return { text: `${plural(late, 'day')} late`, late: true };
  if (late < 31) return { text: `${plural(Math.round(late / 7), 'week')} late`, late: true };
  return { text: `${plural(Math.round(late / 30), 'month')} late`, late: true };
}
