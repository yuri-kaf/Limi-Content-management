import { Lead, LeadDraft, LeadLostReason, LeadSource, LeadStatus } from './types.js';
import { STAGES } from './utils.js';

// ─── Statuses ────────────────────────────────────────────────────────────────

// Active leads are being worked, parked ones are worth another try later, and
// closed ones are done either way. Tabs, counts and the follow-up rules all
// read the group, never a list of statuses of their own.
export type LeadGroup = 'active' | 'parked' | 'closed';

export interface LeadStatusMeta {
  id: LeadStatus;
  label: string;
  group: LeadGroup;
  /** One line on when to use it, shown in the status menu. */
  hint: string;
  tint: string;
  text: string;
  tintDark: string;
  textDark: string;
}

// The pill pairs are borrowed from the board's stages and the neutral and
// brand tokens, all of which color.test.ts already holds to WCAG AA, so the
// leads page adds no new colour to the system. leads.test.ts checks them again.
const stagePair = (id: string) => {
  const s = STAGES.find((x) => x.id === id)!;
  return { tint: s.tint, text: s.text, tintDark: s.tintDark, textDark: s.textDark };
};
const NEUTRAL = { tint: '#f7f7f5', text: '#52514c', tintDark: '#252525', textDark: '#b4b4b0' };
const QUIET = { tint: '#f7f7f5', text: '#6b6a65', tintDark: '#252525', textDark: '#999995' };
const RED = { tint: '#fdf2f2', text: '#b91c1c', tintDark: '#2a1414', textDark: '#f87171' };

export const LEAD_STATUSES: LeadStatusMeta[] = [
  { id: 'new', label: 'To contact', group: 'active', hint: 'Found, not messaged yet', ...NEUTRAL },
  { id: 'approached', label: 'Approached', group: 'active', hint: 'Messaged, waiting for a reply', ...stagePair('review') },
  { id: 'positive', label: 'Positive', group: 'active', hint: 'Replied and interested', ...stagePair('editing') },
  { id: 'proposal', label: 'Proposal', group: 'active', hint: 'Proposal or price sent', ...stagePair('to-post') },
  { id: 'roadblock', label: 'Roadblock', group: 'active', hint: 'Interested but stuck on something', ...RED },
  { id: 'later', label: 'Not now', group: 'parked', hint: 'Good fit, not ready yet', ...stagePair('backup') },
  { id: 'no-reply', label: 'No reply', group: 'parked', hint: 'Never answered', ...stagePair('backup') },
  { id: 'onboarded', label: 'Onboarded', group: 'closed', hint: 'Signed: becomes a client', ...stagePair('posted') },
  { id: 'denied', label: 'Denied', group: 'closed', hint: 'Said no', ...QUIET },
];

export function leadStatus(id: LeadStatus): LeadStatusMeta {
  return LEAD_STATUSES.find((s) => s.id === id) ?? LEAD_STATUSES[0];
}

export const LEAD_SOURCES: { id: LeadSource; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'call', label: 'Phone call' },
  { id: 'email', label: 'Email' },
  { id: 'walk-in', label: 'Walk-in' },
  { id: 'referral', label: 'Referral' },
  { id: 'event', label: 'Event' },
  { id: 'website', label: 'Website' },
  { id: 'other', label: 'Other' },
];

export function sourceLabel(id: LeadSource): string {
  return LEAD_SOURCES.find((s) => s.id === id)?.label ?? 'Other';
}

export const LOST_REASONS: { id: LeadLostReason; label: string }[] = [
  { id: 'not-interested', label: 'Not interested' },
  { id: 'no-budget', label: 'No budget' },
  { id: 'price', label: 'Too expensive' },
  { id: 'has-agency', label: 'Has an agency' },
  { id: 'in-house', label: 'Does it in-house' },
  { id: 'bad-fit', label: 'Not a fit for us' },
  { id: 'unreachable', label: 'Wrong or dead contact' },
  { id: 'other', label: 'Other' },
];

export function lostReasonLabel(id: LeadLostReason | undefined): string {
  return LOST_REASONS.find((r) => r.id === id)?.label ?? '';
}

// ─── Profiles and contacts ───────────────────────────────────────────────────

export type SocialField = 'instagram' | 'tiktok' | 'facebook';

const SOCIAL_HOSTS: Record<SocialField, RegExp> = {
  instagram: /(?:^|\.)instagram\.com$/i,
  tiktok: /(?:^|\.)tiktok\.com$/i,
  facebook: /(?:^|\.)(?:facebook\.com|fb\.com)$/i,
};

const SOCIAL_BASE: Record<SocialField, string> = {
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/@',
  facebook: 'https://www.facebook.com/',
};

function asUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!/^(https?:\/\/)?([\w-]+\.)+\w{2,}\//i.test(value)) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

/**
 * The bare handle in what was typed: "@cafe.ktm", "cafe.ktm" and
 * "instagram.com/cafe.ktm/?igsh=x" all give "cafe.ktm". Lower case, because
 * Instagram and TikTok handles are case-insensitive and duplicates must match.
 */
export function handleOf(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const url = asUrl(value);
  if (url) {
    // profile.php?id=123 is how Facebook addresses a page without a username.
    const fbId = url.searchParams.get('id');
    if (fbId && /profile\.php$/i.test(url.pathname)) return fbId;
    const first = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return first.replace(/^@/, '').toLowerCase();
  }
  return value.replace(/^@/, '').replace(/\s+/g, '').toLowerCase();
}

/** A link that opens the profile, from a handle or a URL. */
export function profileUrl(field: SocialField, raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (asUrl(value)) return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const handle = handleOf(value);
  return handle ? `${SOCIAL_BASE[field]}${handle}` : '';
}

export function websiteUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * What a pasted link or handle is. A profile URL names its platform; a bare
 * "@handle" is taken as Instagram, where most leads are found.
 */
export function parseProfileInput(
  raw: string
): { field: SocialField; handle: string } | null {
  const value = raw.trim();
  if (!value) return null;
  const url = asUrl(value);
  if (url) {
    const field = (Object.keys(SOCIAL_HOSTS) as SocialField[]).find((f) =>
      SOCIAL_HOSTS[f].test(url.hostname)
    );
    const handle = handleOf(value);
    return field && handle ? { field, handle } : null;
  }
  if (/^@?[\w.]{2,30}$/.test(value)) return { field: 'instagram', handle: handleOf(value) };
  return null;
}

/** "cafe.ktm" → "Cafe Ktm": a starting name the user can correct. */
export function nameFromHandle(handle: string): string {
  return handle
    .split(/[._]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Digits only, last ten, so "+977 984-1234567" and "9841234567" match. */
export function phoneKey(raw: string | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// Nepal's mobile numbers are ten digits starting with 9; wa.me needs the
// country code in front, so one typed without it gets 977.
export function whatsappUrl(raw: string | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const full = digits.length === 10 && digits.startsWith('9') ? `977${digits}` : digits;
  return `https://wa.me/${full}`;
}

export function telUrl(raw: string | undefined): string {
  const value = (raw ?? '').replace(/[^\d+]/g, '');
  return value ? `tel:${value}` : '';
}

/** The handle to show under a lead's name: the one it was found through first. */
export function primaryHandle(lead: Pick<Lead, 'source' | SocialField>): { field: SocialField; handle: string } | null {
  const order: SocialField[] =
    lead.source === 'tiktok'
      ? ['tiktok', 'instagram', 'facebook']
      : lead.source === 'facebook'
        ? ['facebook', 'instagram', 'tiktok']
        : ['instagram', 'tiktok', 'facebook'];
  for (const field of order) {
    const handle = handleOf(lead[field]);
    if (handle) return { field, handle };
  }
  return null;
}

// ─── Duplicates ──────────────────────────────────────────────────────────────

export interface DuplicateMatch {
  lead: Lead;
  /** What matched, for the warning: "Instagram @cafe.ktm". */
  on: string;
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Leads that look like the same business: the same handle on any platform,
 * the same phone, the same email, or the same name. Approaching a business
 * twice, or after it has said no, is what this is here to stop.
 */
export function findDuplicates(
  draft: Partial<LeadDraft>,
  leads: Lead[],
  excludeId?: string
): DuplicateMatch[] {
  const handles = (['instagram', 'tiktok', 'facebook'] as SocialField[])
    .map((f) => ({ f, h: handleOf(draft[f]) }))
    .filter((x) => x.h);
  const phone = phoneKey(draft.phone);
  const email = norm(draft.email);
  const name = norm(draft.name);
  const labels: Record<SocialField, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

  const out: DuplicateMatch[] = [];
  for (const lead of leads) {
    if (lead.id === excludeId) continue;
    let on = '';
    for (const { f, h } of handles) {
      if (handleOf(lead[f]) === h) {
        on = `${labels[f]} @${h}`;
        break;
      }
    }
    if (!on && phone.length >= 7 && phoneKey(lead.phone) === phone) on = 'phone number';
    if (!on && email && norm(lead.email) === email) on = 'email';
    if (!on && name.length >= 3 && norm(lead.name) === name) on = 'name';
    if (on) out.push({ lead, on });
  }
  return out;
}

// ─── Days and follow-ups ─────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** A local calendar day as 'YYYY-MM-DD'. Local, not UTC: see toDateInput. */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Calendar arithmetic on a day string, safe across month ends and DST. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + n, 12);
  return dayOf(date.getTime());
}

export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  // Clamp to the target month's last day, so 31 January + 1 is 28/29 February.
  const last = new Date(y, m - 1 + n + 1, 0, 12).getDate();
  return dayOf(new Date(y, m - 1 + n, Math.min(d, last), 12).getTime());
}

export const FOLLOW_UP_PRESETS: { label: string; day: (today: string) => string }[] = [
  { label: 'Tomorrow', day: (t) => addDays(t, 1) },
  { label: 'In 3 days', day: (t) => addDays(t, 3) },
  { label: 'Next week', day: (t) => addDays(t, 7) },
  { label: 'In a month', day: (t) => addMonths(t, 1) },
  { label: 'In 3 months', day: (t) => addMonths(t, 3) },
];

export type FollowUpState = 'overdue' | 'today' | 'upcoming';

/** Closed leads never come due: a denied business is not chased. */
export function followUpState(lead: Pick<Lead, 'status' | 'followUpOn'>, today: string): FollowUpState | null {
  if (!lead.followUpOn || leadStatus(lead.status).group === 'closed') return null;
  if (lead.followUpOn < today) return 'overdue';
  if (lead.followUpOn === today) return 'today';
  return 'upcoming';
}

export function isDue(lead: Pick<Lead, 'status' | 'followUpOn'>, today: string): boolean {
  const s = followUpState(lead, today);
  return s === 'overdue' || s === 'today';
}

/** "3 Nov", or "3 Feb 2027" outside this year. */
export function shortDay(day: string, today: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const sameYear = today.slice(0, 4) === day.slice(0, 4);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "Today", "Tomorrow", "3 days late", "12 Nov". */
export function followUpLabel(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day < today) {
    const late = Math.round(
      (new Date(`${today}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()) / 86400000
    );
    return late === 1 ? 'Yesterday' : `${late} days late`;
  }
  return shortDay(day, today);
}

// ─── Views, search and order ─────────────────────────────────────────────────

export type LeadView = 'active' | 'follow-up' | 'parked' | 'onboarded' | 'denied' | 'all';

// Denied and onboarded leads are never deleted, only moved out of the way: a
// tab of their own keeps them one tap from the list, and out of it.
export const LEAD_VIEWS: { id: LeadView; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'follow-up', label: 'Follow up' },
  { id: 'parked', label: 'Not now' },
  { id: 'onboarded', label: 'Onboarded' },
  { id: 'denied', label: 'Denied' },
  { id: 'all', label: 'All' },
];

export function inView(lead: Lead, view: LeadView, today: string): boolean {
  const group = leadStatus(lead.status).group;
  switch (view) {
    case 'active': return group === 'active';
    case 'follow-up': return isDue(lead, today);
    case 'parked': return group === 'parked';
    case 'onboarded': return lead.status === 'onboarded';
    case 'denied': return lead.status === 'denied';
    default: return true;
  }
}

export function matchesQuery(lead: Lead, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const hay = [
    lead.name, lead.contactName, lead.note, lead.industry, lead.location, lead.email,
    handleOf(lead.instagram), handleOf(lead.tiktok), handleOf(lead.facebook), lead.website,
  ].map((s) => (s ?? '').toLowerCase());
  if (hay.some((s) => s.includes(q))) return true;
  return digits.length >= 4 && phoneKey(lead.phone).includes(digits);
}

export type LeadSort = 'best' | 'recent' | 'follow-up' | 'name';

export const LEAD_SORTS: { id: LeadSort; label: string }[] = [
  { id: 'best', label: 'Best first' },
  { id: 'recent', label: 'Recently updated' },
  { id: 'follow-up', label: 'Follow-up date' },
  { id: 'name', label: 'Name' },
];

const DUE_RANK: Record<FollowUpState | 'none', number> = { overdue: 0, today: 1, upcoming: 2, none: 3 };

/**
 * Best first: the most promising at the top, and among equals whatever is due
 * before whatever is not, then the most recently touched. This is what lets a
 * list of a hundred approached businesses still show the ten that matter.
 */
export function sortLeads(leads: Lead[], sort: LeadSort, today: string): Lead[] {
  const list = [...leads];
  const byRecent = (a: Lead, b: Lead) => b.updatedAt - a.updatedAt;
  if (sort === 'recent') return list.sort(byRecent);
  if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'follow-up') {
    return list.sort((a, b) => {
      if (a.followUpOn && b.followUpOn) return a.followUpOn.localeCompare(b.followUpOn) || byRecent(a, b);
      if (a.followUpOn) return -1;
      if (b.followUpOn) return 1;
      return byRecent(a, b);
    });
  }
  return list.sort((a, b) => {
    const p = (b.potential ?? 0) - (a.potential ?? 0);
    if (p) return p;
    const d = DUE_RANK[followUpState(a, today) ?? 'none'] - DUE_RANK[followUpState(b, today) ?? 'none'];
    return d || byRecent(a, b);
  });
}

/** Follow-ups due today or overdue: the number the sidebar shows. */
export function leadsDue(leads: Lead[], today: string): number {
  return leads.filter((l) => isDue(l, today)).length;
}

/** "3d ago" for the list's last-touched column. */
export function ago(ms: number, now: number): string {
  const mins = Math.floor((now - ms) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}
