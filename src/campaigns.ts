import {
  Business, Campaign, CampaignStatus, Client, ContentItem, Deliverable, FolderColor,
} from './types';
import { awaitingReview } from './nav';
import { DEFAULT_FOLDER_COLOR } from './folderColors';

// ─── Scope ───────────────────────────────────────────────────────────────────

/** "Content outside every campaign" in a campaign filter. Never a real id. */
export const NO_CAMPAIGN = '__none__';

/**
 * The business an item or idea belongs to. Anything written before businesses
 * existed has no businessId and belongs to the client's first business — the
 * one the migration creates — so nothing goes missing between deploying this
 * and running the migration. An id naming a business that is gone (possible if
 * a delete raced an edit) falls back the same way, rather than leaving the item
 * outside every business, where no business view would ever show it.
 */
export function businessIdOf(
  item: { businessId?: string },
  businesses: Pick<Business, 'id'>[]
): string | undefined {
  const id = item.businessId;
  return id && businesses.some((b) => b.id === id) ? id : businesses[0]?.id;
}

/** A campaignId naming a campaign that no longer exists counts as none. */
export function campaignIdOf(
  item: { campaignId?: string },
  campaigns: Pick<Campaign, 'id'>[]
): string | undefined {
  const id = item.campaignId;
  return id && campaigns.some((c) => c.id === id) ? id : undefined;
}

export interface ContentScope {
  businessId?: string;
  /** A campaign id, or NO_CAMPAIGN for items outside every campaign. */
  campaignId?: string;
}

export function scopeContent(
  content: ContentItem[],
  scope: ContentScope,
  businesses: Pick<Business, 'id'>[],
  campaigns: Pick<Campaign, 'id'>[]
): ContentItem[] {
  return content.filter((item) => {
    if (scope.businessId && businessIdOf(item, businesses) !== scope.businessId) return false;
    if (scope.campaignId) {
      const campaign = campaignIdOf(item, campaigns);
      const wanted = scope.campaignId === NO_CAMPAIGN ? undefined : scope.campaignId;
      if (campaign !== wanted) return false;
    }
    return true;
  });
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface DeliverableProgress {
  deliverable: Deliverable;
  /** Items linked to this deliverable, oldest first. */
  items: ContentItem[];
  posted: number;
  /**
   * The target, or more if more were made. Every view of a deliverable's
   * progress reads this rather than the target, so a row and the campaign it
   * belongs to can never disagree: four reels made against three planned is
   * "3 of 4 posted" in both, not "3/3" in one and 75% in the other.
   */
  planned: number;
}

// Progress is counted, never stored, so it cannot drift from the board.
export function deliverableProgress(campaign: Campaign, content: ContentItem[]): DeliverableProgress[] {
  const inCampaign = content.filter((i) => i.campaignId === campaign.id);
  return campaign.deliverables.map((deliverable) => {
    const items = inCampaign
      .filter((i) => i.deliverableId === deliverable.id)
      .sort((a, b) => a.createdAt - b.createdAt);
    return {
      deliverable,
      items,
      posted: items.filter((i) => i.status === 'posted').length,
      planned: Math.max(deliverable.target, items.length),
    };
  });
}

/** In the campaign but filling no deliverable — never slotted, or slotted into one since removed. */
export function unslottedContent(campaign: Campaign, content: ContentItem[]): ContentItem[] {
  const slots = new Set(campaign.deliverables.map((d) => d.id));
  return content
    .filter((i) => i.campaignId === campaign.id && !(i.deliverableId && slots.has(i.deliverableId)))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export interface CampaignProgress {
  posted: number;
  /** Each deliverable's target (or more, if more were made) plus anything unslotted. */
  planned: number;
  /** posted / planned, and 0 when nothing is planned. */
  ratio: number;
}

// Every posted item is also counted in `planned`, so the ratio can never pass
// 1 — making four reels against a target of three plans four, not three.
export function campaignProgress(campaign: Campaign, content: ContentItem[]): CampaignProgress {
  const slots = deliverableProgress(campaign, content);
  const extra = unslottedContent(campaign, content);
  const planned = slots.reduce((sum, s) => sum + s.planned, 0) + extra.length;
  const posted =
    slots.reduce((sum, s) => sum + s.posted, 0) + extra.filter((i) => i.status === 'posted').length;
  return { posted, planned, ratio: planned === 0 ? 0 : posted / planned };
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface CampaignStatusMeta {
  id: CampaignStatus;
  label: string;
  color: FolderColor;
}

/** In lifecycle order — the order a status picker lists them. */
export const CAMPAIGN_STATUSES: CampaignStatusMeta[] = [
  { id: 'planning', label: 'Planning', color: 'graphite' },
  { id: 'live', label: 'Live', color: 'green' },
  { id: 'completed', label: 'Completed', color: 'blue' },
];

/** The order campaigns are grouped in: what is running now comes first. */
export const CAMPAIGN_GROUP_ORDER: CampaignStatus[] = ['live', 'planning', 'completed'];

export function campaignStatusMeta(status: CampaignStatus): CampaignStatusMeta {
  return CAMPAIGN_STATUSES.find((s) => s.id === status) ?? CAMPAIGN_STATUSES[0];
}

// ISO days ('YYYY-MM-DD') sort correctly as plain strings. Undated goes last.
function byStartDate(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
}

/** Live, then planning, then completed; within each, by start date with undated last. */
export function sortCampaigns(campaigns: Campaign[]): Campaign[] {
  const rank = (s: CampaignStatus) => CAMPAIGN_GROUP_ORDER.indexOf(s);
  return [...campaigns].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      byStartDate(a.startDate, b.startDate) ||
      a.createdAt - b.createdAt
  );
}

// ─── Businesses ──────────────────────────────────────────────────────────────

export interface BusinessSummary {
  total: number;
  awaitingReview: number;
  /** Planning or live — anything not yet completed. */
  activeCampaigns: number;
}

export function businessSummary(
  businessId: string,
  businesses: Pick<Business, 'id'>[],
  content: ContentItem[],
  campaigns: Pick<Campaign, 'businessId' | 'status'>[]
): BusinessSummary {
  const mine = content.filter((i) => businessIdOf(i, businesses) === businessId);
  return {
    total: mine.length,
    awaitingReview: awaitingReview(mine),
    activeCampaigns: campaigns.filter(
      (c) => c.businessId === businessId && c.status !== 'completed'
    ).length,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Why a business cannot be deleted, or null when it can. Deleting one that
 * still holds content or campaigns would strand them in no business at all.
 * The first business is never deletable: anything without a businessId —
 * content before the migration, ideas from before businesses existed — belongs
 * to it, and would silently move to whichever business became first instead.
 * (Ideas filed under a later business do not block: deleteBusiness() moves
 * them to the first business in the same batch.)
 */
export function businessDeleteBlocker(
  businessId: string,
  businesses: Pick<Business, 'id'>[],
  content: ContentItem[],
  campaigns: Pick<Campaign, 'businessId'>[]
): string | null {
  if (businesses.length <= 1) return 'A client always keeps at least one business.';
  if (businesses[0].id === businessId) {
    return 'This is the first business, which holds everything filed before businesses existed, so it cannot be deleted. Rename it instead.';
  }
  const items = content.filter((i) => businessIdOf(i, businesses) === businessId).length;
  if (items > 0) {
    return `It still holds ${plural(items, 'content item')}. Move ${items === 1 ? 'it' : 'them'} to another business or delete ${items === 1 ? 'it' : 'them'} first.`;
  }
  const owned = campaigns.filter((c) => c.businessId === businessId).length;
  if (owned > 0) {
    return `It still has ${plural(owned, 'campaign')}. Delete ${owned === 1 ? 'it' : 'them'} first.`;
  }
  return null;
}

// The id of the business every client starts with. Fixed rather than random,
// so that creating it is idempotent: two tabs or two admins running the
// migration at once write the same document instead of two "first" businesses.
export const DEFAULT_BUSINESS_ID = 'main';

/**
 * A client's businesses with 'main' first and the rest in the order given
 * (createdAt). Everything unfiled belongs to the first business, so a skewed
 * clock on whoever added another one must not let it sort ahead of 'main'.
 */
export function firstBusinessFirst<T extends Pick<Business, 'id'>>(businesses: T[]): T[] {
  // Array.sort is stable, so everything but 'main' keeps its order.
  return [...businesses].sort((a, b) =>
    a.id === DEFAULT_BUSINESS_ID ? -1 : b.id === DEFAULT_BUSINESS_ID ? 1 : 0
  );
}

/** The business every client starts with, named, coloured and pictured after the client. */
export function defaultBusinessFor(
  client: { name: string; imageUrl?: string; about?: string; color?: FolderColor },
  createdAt: number
): Omit<Business, 'id'> {
  return {
    name: client.name,
    color: client.color ?? DEFAULT_FOLDER_COLOR,
    // Omitted, not undefined: Firestore rejects an undefined field outright.
    ...(client.imageUrl ? { logoUrl: client.imageUrl } : {}),
    about: client.about ?? '',
    createdAt,
  };
}

export interface BusinessMigrationStep {
  clientId: string;
  /** True when the client has no business yet and the migration must create one. */
  createDefault: boolean;
  /** Items that carry no businessId. */
  contentIds: string[];
}

export function planBusinessMigration(
  clients: Pick<Client, 'id' | 'content' | 'businesses'>[]
): BusinessMigrationStep[] {
  return clients
    .map((c) => ({
      clientId: c.id,
      createDefault: c.businesses.length === 0,
      contentIds: c.content.filter((i) => !i.businessId).map((i) => i.id),
    }))
    .filter((s) => s.createDefault || s.contentIds.length > 0);
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 'YYYY-MM-DD' as "Oct 3". Built from the parts rather than new Date(value),
 * which reads an ISO day as UTC midnight — the day before, west of Greenwich.
 */
function dayLabel(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Anything that is not an ISO day counts as no date, so a hand-edited value
// renders as nothing rather than "From Invalid Date".
export function formatDateRange(start?: string, end?: string): string {
  const from = start && ISO_DAY.test(start) ? start : undefined;
  const to = end && ISO_DAY.test(end) ? end : undefined;
  if (from && to) return from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
  if (from) return `From ${dayLabel(from)}`;
  if (to) return `Until ${dayLabel(to)}`;
  return '';
}

/** True only when both days are set and the end comes first. ISO days compare as strings. */
export function endsBeforeStart(start?: string, end?: string): boolean {
  return !!start && !!end && end < start;
}
