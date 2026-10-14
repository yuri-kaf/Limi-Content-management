import './env.js';
import type {
  AppUser, Business, Campaign, Client, Comment, ContentItem, Idea,
} from '../../src/types.js';
import { firstBusinessFirst } from '../../src/campaigns.js';
import { todaySources } from '../../src/today.js';
import { FirestoreError, type FirestoreClient } from './firestore.js';

// The data layer, mirroring src/store.ts over Firestore REST. Every read and
// write runs as the signed-in person, so firestore.rules bound it exactly as
// they bound the app.

export interface Session {
  fs: FirestoreClient;
  profile: AppUser;
  now: () => number;
}

/** A message meant for the person, shown as it is. */
export class LimiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LimiError';
  }
}

export const ROLE_REFUSED = "Your Limi role can't do that.";
export const NO_SUCH_POST = "No such post (or you can't see it).";

/** Any failure as one plain sentence — never a stack trace. */
export function plainMessage(err: unknown): string {
  if (err instanceof LimiError) return err.message;
  if (err instanceof FirestoreError) {
    if (err.status === 403) return ROLE_REFUSED;
    if (err.status === 404) return NO_SUCH_POST;
    if (err.status === 401) return 'Your Limi sign-in has expired. Sign in again.';
    return 'The Limi database could not answer just now. Try again in a moment.';
  }
  return 'Something went wrong in Limi. Try again in a moment.';
}

export function actorOf(session: Session) {
  return { email: session.profile.email, name: session.profile.name || 'Someone' };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** null when the account has no profile, which means it has no access at all. */
export async function getProfile(fs: FirestoreClient, uid: string): Promise<AppUser | null> {
  try {
    const doc = await fs.get<Omit<AppUser, 'id'>>(`users/${uid}`);
    if (!doc) return null;
    return { ...doc, id: uid, assignedClientIds: doc.assignedClientIds ?? [] };
  } catch (err) {
    if (err instanceof FirestoreError && err.status === 403) return null;
    throw err;
  }
}

export type ClientInfo = Omit<Client, 'content' | 'businesses'>;

const byCreated = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

// The legacy `content` array some client documents still carry is left out,
// as the app leaves it out.
function toClientInfo(d: Record<string, unknown> & { id: string }): ClientInfo {
  return {
    id: d.id,
    name: String(d.name ?? ''),
    about: String(d.about ?? ''),
    createdAt: Number(d.createdAt ?? 0),
    ...(d.imageUrl ? { imageUrl: String(d.imageUrl) } : {}),
    ...(d.color ? { color: d.color as Client['color'] } : {}),
  };
}

/** The clients this login can see, oldest first. */
export async function listClients(session: Session): Promise<ClientInfo[]> {
  const { fs, profile } = session;
  let docs: (Record<string, unknown> & { id: string })[];
  if (profile.role === 'client') {
    // Rules are not filters: listing the collection is refused outright to a
    // client, so each assigned client is read by id — as useClients does.
    const found = await Promise.all(
      profile.assignedClientIds.map((id) =>
        fs.get(`clients/${id}`).catch((err: unknown) => {
          if (err instanceof FirestoreError && err.status === 403) return null;
          throw err;
        })
      )
    );
    docs = found.filter((d): d is Record<string, unknown> & { id: string } => d !== null);
  } else {
    docs = await fs.list('clients');
  }
  return docs.map(toClientInfo).sort(byCreated);
}

/** A client with its content, businesses (first business first) and campaigns. */
export type ClientData = Client & { campaigns: Campaign[] };

/**
 * Everything the tools read, for every visible client. A client login never
 * sees work still in Editing, as in the app (todaySources).
 */
export async function loadWorkspace(session: Session): Promise<ClientData[]> {
  const { fs, profile } = session;
  const infos = await listClients(session);
  const loaded = await Promise.all(
    infos.map(async (info) => {
      const [content, businesses, campaigns] = await Promise.all([
        fs.list<Omit<ContentItem, 'id'>>(`clients/${info.id}/content`),
        fs.list<Omit<Business, 'id'>>(`clients/${info.id}/businesses`),
        fs.list<Omit<Campaign, 'id'>>(`clients/${info.id}/campaigns`),
      ]);
      return {
        client: { ...info, content: content.sort(byCreated), businesses: firstBusinessFirst(businesses.sort(byCreated)) },
        campaigns: campaigns.sort(byCreated),
      };
    })
  );
  const visible = todaySources(loaded.map((l) => l.client), profile);
  return visible.map((client) => ({
    ...client,
    campaigns: loaded.find((l) => l.client.id === client.id)?.campaigns ?? [],
  }));
}

export async function loadComments(session: Session, clientId: string, contentId: string): Promise<Comment[]> {
  const comments = await session.fs.list<Omit<Comment, 'id'>>(`clients/${clientId}/content/${contentId}/comments`);
  return comments.sort(byCreated);
}

/** Newest first, as the Ideas tab lists them. */
export async function loadIdeas(session: Session, clientId: string): Promise<Idea[]> {
  const ideas = await session.fs.list<Omit<Idea, 'id'>>(`clients/${clientId}/ideas`);
  return ideas.sort((a, b) => b.createdAt - a.createdAt);
}

export function findContent(clients: ClientData[], contentId: string): { client: ClientData; item: ContentItem } {
  for (const client of clients) {
    const item = client.content.find((i) => i.id === contentId.trim());
    if (item) return { client, item };
  }
  throw new LimiError(NO_SUCH_POST);
}

// ─── Picking by name ─────────────────────────────────────────────────────────

export interface Named {
  id: string;
  name: string;
}

/**
 * The one item matching an id or a name. An exact id or name wins; otherwise a
 * single partial name match. None, or several, is a question back to Claude.
 */
export function pick<T extends Named>(items: T[], query: string, what: string, label = (i: T) => i.name): T {
  const q = query.trim().toLowerCase();
  const exact = items.filter((i) => i.id === query.trim() || i.name.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const candidates = exact.length > 1 ? exact : items.filter((i) => i.name.toLowerCase().includes(q));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    const known = items.map(label).join(', ') || 'none';
    throw new LimiError(`No ${what} matches "${query}". The ${what}s you can see: ${known}.`);
  }
  throw new LimiError(`Several ${what}s match "${query}": ${candidates.map(label).join(', ')}. Which one?`);
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-16T15:00+05:45": ISO 8601 with Kathmandu's offset. */
export function kathmanduIso(ms: number): string {
  const d = new Date(ms);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** "Fri 16 Oct 2026, 3:00 PM". Built from parts, so no ICU spacing quirks. */
export function kathmanduText(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/**
 * "2026-10-20" or "2026-10-20 15:30" (a T works too), read as Kathmandu local
 * time. A day alone means midnight, as the app's date field does.
 */
export function parseWhen(input: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(input.trim());
  const fail = () =>
    new LimiError(`"${input}" is not a date Limi understands. Use 2026-10-20 or 2026-10-20 15:30 (Kathmandu time).`);
  if (!m) throw fail();
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0'].map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d || h > 23 || mi > 59) throw fail();
  return date.getTime();
}
