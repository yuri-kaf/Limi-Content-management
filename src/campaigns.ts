import { Business, Campaign, ContentItem } from './types';

// ─── Scope ───────────────────────────────────────────────────────────────────

/** "Content outside every campaign" in a campaign filter. Never a real id. */
export const NO_CAMPAIGN = '__none__';

/**
 * The business an item or idea belongs to. Anything written before businesses
 * existed has no businessId and belongs to the client's first business — the
 * one the migration creates — so nothing goes missing between deploying this
 * and running the migration.
 */
export function businessIdOf(
  item: { businessId?: string },
  businesses: Pick<Business, 'id'>[]
): string | undefined {
  return item.businessId ?? businesses[0]?.id;
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
