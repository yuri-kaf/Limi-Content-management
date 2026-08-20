import { AppUser, Client } from './types';

export type PaletteKind = 'page' | 'client' | 'content' | 'command';

export interface PaletteItem {
  id: string;
  kind: PaletteKind;
  /** What the user reads and what the query matches against. */
  label: string;
  /** The line under the label — a client name, a stage, a hint. */
  detail?: string;
  /** Where selecting it goes. Mutually exclusive with `command`. */
  path?: string;
  /** A named action the palette host performs, for entries with no route. */
  command?: 'toggle-theme' | 'sign-out' | 'new-content';
  /** Extra words that should match without being displayed. */
  keywords?: string;
  clientId?: string;
  imageUrl?: string;
}

// Subsequence match, the same rule every command palette uses: the query's
// characters must appear in order but need not be adjacent, so "mtg sup" finds
// "Mortgage Superheroes". Returns a score where lower is better, or null for no
// match — a boolean would leave the ranking to insertion order, which puts the
// hundredth content item above the client whose name you actually typed.
export function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();

  // An exact prefix is always the best possible match.
  if (hay.startsWith(needle)) return -1000;

  let score = 0;
  let at = 0;
  let previous = -1;
  for (const ch of needle) {
    const found = hay.indexOf(ch, at);
    if (found === -1) return null;
    // A run of adjacent characters is worth more than the same letters
    // scattered across the string, and a match at a word boundary more than one
    // in the middle of a word.
    const adjacent = found === previous + 1;
    const boundary = found === 0 || hay[found - 1] === ' ' || hay[found - 1] === '-';
    score += adjacent ? 0 : boundary ? 2 : 6;
    score += found - at;
    previous = found;
    at = found + 1;
  }
  // Shorter targets win ties: "Ideas" beats "Ideas for the summer campaign".
  return score + hay.length / 100;
}

// Kinds are ordered so that a two-letter query surfaces places before the
// content that happens to contain those letters.
const KIND_WEIGHT: Record<PaletteKind, number> = {
  page: 0,
  client: 1,
  content: 2,
  command: 3,
};

export function buildIndex(clients: Client[], user: AppUser | null): PaletteItem[] {
  if (!user) return [];

  const isClientRole = user.role === 'client';
  const visible = isClientRole
    ? clients.filter((c) => user.assignedClientIds?.includes(c.id))
    : clients;

  const items: PaletteItem[] = [
    { id: 'page-today', kind: 'page', label: 'Today', detail: 'What needs you', path: '/', keywords: 'home queue inbox' },
    { id: 'page-clients', kind: 'page', label: 'Clients', detail: 'Every board', path: '/clients', keywords: 'boards grid' },
    { id: 'page-profile', kind: 'page', label: 'Profile', detail: 'Your account', path: '/profile', keywords: 'account settings me' },
  ];
  if (user.role === 'admin') {
    items.push({ id: 'page-users', kind: 'page', label: 'Team', detail: 'People and roles', path: '/users', keywords: 'users staff permissions' });
  }

  for (const client of visible) {
    items.push({
      id: `client-${client.id}`,
      kind: 'client',
      label: client.name,
      detail: 'Open board',
      path: `/client/${client.id}`,
      clientId: client.id,
      imageUrl: client.imageUrl,
    });
    for (const item of client.content ?? []) {
      items.push({
        id: `content-${client.id}-${item.id}`,
        kind: 'content',
        label: item.title,
        detail: client.name,
        // Deep link, so a hit opens the item rather than dropping you on the
        // board to hunt for it.
        path: `/client/${client.id}?item=${item.id}`,
        clientId: client.id,
        keywords: `${item.status} ${item.caption ?? ''}`,
      });
    }
  }

  items.push(
    { id: 'cmd-theme', kind: 'command', label: 'Toggle light / dark', command: 'toggle-theme', keywords: 'theme dark light appearance' },
    { id: 'cmd-signout', kind: 'command', label: 'Sign out', command: 'sign-out', keywords: 'logout leave exit' }
  );

  return items;
}

export function searchIndex(index: PaletteItem[], query: string, limit = 30): PaletteItem[] {
  const trimmed = query.trim();

  // With no query the palette is a menu, not a search box: show the places and
  // the commands, never a thousand content titles in load order.
  if (!trimmed) {
    return index.filter((i) => i.kind === 'page' || i.kind === 'client').slice(0, limit);
  }

  const needle = trimmed.toLowerCase();

  return index
    .map((item) => {
      const direct = fuzzyScore(item.label, trimmed);
      // Keywords are matched as a substring, never fuzzily. A subsequence test
      // over long prose — and `keywords` carries the caption — matches almost
      // any short query: "refin" found every item in the workspace, because
      // some caption somewhere contains r…e…f…i…n in order. A name is short
      // enough for fuzzy to mean something; a paragraph is not.
      const viaKeyword = item.keywords?.toLowerCase().includes(needle) ? 60 : null;
      const best = direct !== null ? direct : viaKeyword;
      return best === null ? null : { item, score: best + KIND_WEIGHT[item.kind] * 3 };
    })
    .filter((r): r is { item: PaletteItem; score: number } => r !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((r) => r.item);
}

export const KIND_LABELS: Record<PaletteKind, string> = {
  page: 'Places',
  client: 'Boards',
  content: 'Content',
  command: 'Commands',
};

/** Results in display order, grouped by kind, preserving the ranking within each. */
export function groupResults(results: PaletteItem[]): { kind: PaletteKind; items: PaletteItem[] }[] {
  const order: PaletteKind[] = ['page', 'client', 'content', 'command'];
  return order
    .map((kind) => ({ kind, items: results.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0);
}
