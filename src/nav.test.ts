import { awaitingReview, buildNav } from './nav';
import { AppUser, Client, ContentItem } from './types';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 't', driveLink: '', driveFileId: '', status: 'review',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(id: string, content: ContentItem[] = []): Client {
  return { id, name: id.toUpperCase(), about: '', content, createdAt: 1 };
}

function user(role: AppUser['role'], assignedClientIds: string[] = []): AppUser {
  return { id: 'u1', name: 'U', email: 'u@x.com', role, assignedClientIds, createdAt: 1 };
}

describe('awaitingReview', () => {
  it('counts only items in review that the client has not decided', () => {
    expect(awaitingReview([
      item(),
      item({ id: 'i2' }),
      item({ id: 'i3', clientReview: 'approved' }),
      item({ id: 'i4', status: 'posted' }),
    ])).toBe(2);
  });

  it('is 0 for an empty board', () => {
    expect(awaitingReview([])).toBe(0);
  });
});

describe('buildNav', () => {
  const clients = [client('acme', [item()]), client('bolt'), client('cine')];

  it('gives an admin every client and the Team entry', () => {
    const nav = buildNav(clients, user('admin'));
    expect(nav.clients.map((c) => c.id)).toEqual(['acme', 'bolt', 'cine']);
    expect(nav.showTeam).toBe(true);
  });

  it('gives a manager every client but no Team entry', () => {
    const nav = buildNav(clients, user('social-media-manager'));
    expect(nav.clients).toHaveLength(3);
    expect(nav.showTeam).toBe(false);
  });

  it('gives a client only their assigned boards', () => {
    const nav = buildNav(clients, user('client', ['bolt']));
    expect(nav.clients.map((c) => c.id)).toEqual(['bolt']);
    expect(nav.showTeam).toBe(false);
  });

  it('carries the attention count per client', () => {
    const nav = buildNav(clients, user('admin'));
    expect(nav.clients.find((c) => c.id === 'acme')!.attention).toBe(1);
    expect(nav.clients.find((c) => c.id === 'bolt')!.attention).toBe(0);
  });

  it('is empty while the user is still resolving', () => {
    expect(buildNav(clients, null)).toEqual({ clients: [], showTeam: false });
  });
});
