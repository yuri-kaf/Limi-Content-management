import { Business, UserRole } from './types';

export type WorkspaceTab = 'overview' | 'content' | 'campaigns' | 'calendar' | 'ideas';

export interface TabDef {
  id: WorkspaceTab;
  label: string;
}

const ALL_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'ideas', label: 'Ideas' },
];

// Content is where people land: it is what opening a client meant before tabs
// existed, and moving the landing view in the same change as adding tabs would
// be two changes at once.
export const DEFAULT_TAB: WorkspaceTab = 'content';

// Clients keep exactly the three views they had. Overview and Campaigns are
// written for the team — attention queues, deliverable plans — and the
// client-facing version belongs to the client portal, designed separately.
const CLIENT_TABS: WorkspaceTab[] = ['content', 'calendar', 'ideas'];

export function tabsFor(role: UserRole | undefined): TabDef[] {
  return role === 'client' ? ALL_TABS.filter((t) => CLIENT_TABS.includes(t.id)) : ALL_TABS;
}

/** An unknown tab, or one this role cannot see, falls back to the default. */
export function parseTab(value: string | undefined, allowed: TabDef[]): WorkspaceTab {
  return allowed.find((t) => t.id === value)?.id ?? DEFAULT_TAB;
}

function withScope(path: string, businessId?: string): string {
  return businessId ? `${path}?b=${encodeURIComponent(businessId)}` : path;
}

// The default tab keeps the bare URL, so every existing /client/:id link — the
// sidebar, Today, the command palette — still lands where it always did.
export function workspacePath(clientId: string, tab: WorkspaceTab, businessId?: string): string {
  const base = tab === DEFAULT_TAB ? `/client/${clientId}` : `/client/${clientId}/${tab}`;
  return withScope(base, businessId);
}

export function campaignPath(clientId: string, campaignId: string, businessId?: string): string {
  return withScope(`/client/${clientId}/campaign/${campaignId}`, businessId);
}

/**
 * The business named by ?b=. Dropped when the client has fewer than two
 * businesses — there is nothing to choose between — and when it names one the
 * client does not have, such as a business since deleted.
 */
export function resolveScope(
  param: string | null,
  businesses: Pick<Business, 'id'>[]
): string | undefined {
  if (!param || businesses.length < 2) return undefined;
  return businesses.some((b) => b.id === param) ? param : undefined;
}
