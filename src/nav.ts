import { AppUser, Client, ContentItem } from './types';

export interface NavClient {
  id: string;
  name: string;
  imageUrl?: string;
  /** Items sitting in Review that the client has not yet decided on. */
  attention: number;
}

export interface NavModel {
  clients: NavClient[];
  showTeam: boolean;
}

// "Needs someone else" is the only count worth putting in navigation: it is the
// one number that tells you where to look without opening anything.
export function awaitingReview(content: ContentItem[]): number {
  return content.filter((i) => i.status === 'review' && i.clientReview === 'pending').length;
}

export function buildNav(clients: Client[], user: AppUser | null): NavModel {
  // Auth resolves asynchronously; rendering an empty tree beats flashing every
  // client at a user whose role has not arrived yet.
  if (!user) return { clients: [], showTeam: false };

  const visible =
    user.role === 'client'
      ? clients.filter((c) => user.assignedClientIds?.includes(c.id))
      : clients;

  return {
    clients: visible.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      attention: awaitingReview(c.content ?? []),
    })),
    showTeam: user.role === 'admin',
  };
}
