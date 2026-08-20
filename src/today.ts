import { Client, ContentItem } from './types';

export interface TodayEntry {
  clientId: string;
  clientName: string;
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
    (c.content ?? []).map((item) => ({ clientId: c.id, clientName: c.name, item }))
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
