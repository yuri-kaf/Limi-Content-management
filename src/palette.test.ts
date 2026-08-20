import { buildIndex, fuzzyScore, groupResults, searchIndex } from './palette';
import { AppUser, Client, ContentItem } from './types';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 'Video 5: How Much Can I Borrow', driveLink: '', driveFileId: '',
    status: 'editing', createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(id: string, name: string, content: ContentItem[] = []): Client {
  return { id, name, about: '', content, createdAt: 1 };
}

function user(role: AppUser['role'], assignedClientIds: string[] = []): AppUser {
  return { id: 'u1', name: 'U', email: 'u@x.com', role, assignedClientIds, createdAt: 1 };
}

describe('fuzzyScore', () => {
  it('matches a subsequence rather than only a substring', () => {
    expect(fuzzyScore('Mortgage Superheroes', 'mtgsup')).not.toBeNull();
  });

  it('rejects characters that are not present in order', () => {
    expect(fuzzyScore('Mortgage', 'zebra')).toBeNull();
    expect(fuzzyScore('Mortgage', 'egatrom')).toBeNull();
  });

  it('ranks a prefix above a mid-string match', () => {
    const prefix = fuzzyScore('Review notes', 'rev')!;
    const middle = fuzzyScore('Final review', 'rev')!;
    expect(prefix).toBeLessThan(middle);
  });

  it('ranks a tighter run above scattered letters', () => {
    const tight = fuzzyScore('Shopit Nepal', 'nepal')!;
    const loose = fuzzyScore('Nothing else pleases anyone lately', 'nepal')!;
    expect(tight).toBeLessThan(loose);
  });

  it('treats an empty query as a match so the menu renders', () => {
    expect(fuzzyScore('anything', '')).toBe(0);
  });
});

describe('buildIndex', () => {
  const clients = [
    client('a', 'Mortgage Superheroes', [item(), item({ id: 'i2', title: 'Graphic 6: Refinance' })]),
    client('b', 'Shopit Nepal', [item({ id: 'i3', title: 'Vok lako bela' })]),
  ];

  it('is empty until the user resolves', () => {
    expect(buildIndex(clients, null)).toEqual([]);
  });

  it('indexes places, boards, content and commands for an admin', () => {
    const index = buildIndex(clients, user('admin'));
    expect(index.filter((i) => i.kind === 'client')).toHaveLength(2);
    expect(index.filter((i) => i.kind === 'content')).toHaveLength(3);
    expect(index.some((i) => i.label === 'Team')).toBe(true);
    expect(index.some((i) => i.command === 'sign-out')).toBe(true);
  });

  it('hides Team from a non-admin', () => {
    expect(buildIndex(clients, user('social-media-manager')).some((i) => i.label === 'Team'))
      .toBe(false);
  });

  it('scopes a client-role user to their own boards and content', () => {
    const index = buildIndex(clients, user('client', ['b']));
    expect(index.filter((i) => i.kind === 'client').map((i) => i.label)).toEqual(['Shopit Nepal']);
    expect(index.filter((i) => i.kind === 'content').map((i) => i.label)).toEqual(['Vok lako bela']);
  });

  it('deep-links content so a hit opens the item, not just the board', () => {
    const index = buildIndex(clients, user('admin'));
    const hit = index.find((i) => i.label === 'Graphic 6: Refinance')!;
    expect(hit.path).toBe('/client/a?item=i2');
  });
});

describe('searchIndex', () => {
  const index = buildIndex(
    [
      client('a', 'Mortgage Superheroes', [item({ id: 'i2', title: 'Graphic 6: Refinance' })]),
      client('b', 'Shopit Nepal'),
    ],
    user('admin')
  );

  it('shows places and boards as a menu when the query is empty', () => {
    const kinds = new Set(searchIndex(index, '   ').map((r) => r.kind));
    expect(kinds).toEqual(new Set(['page', 'client']));
  });

  it('puts the board above content that merely contains the letters', () => {
    expect(searchIndex(index, 'shopit')[0].label).toBe('Shopit Nepal');
  });

  it('finds content by title', () => {
    expect(searchIndex(index, 'refinance').map((r) => r.label)).toContain('Graphic 6: Refinance');
  });

  it('matches a page through its keywords', () => {
    expect(searchIndex(index, 'logout').map((r) => r.command)).toContain('sign-out');
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchIndex(index, 'qqqqzzzz')).toEqual([]);
  });

  it('does not let a long caption fuzzy-match every short query', () => {
    const wordy = buildIndex(
      [
        client('a', 'Acme', [
          item({ id: 'i9', title: 'Award Post', caption: 'Our founder, reflecting on nine years' }),
          item({ id: 'i8', title: 'Refinancing' }),
        ]),
      ],
      user('admin')
    );
    expect(searchIndex(wordy, 'refin').map((r) => r.label)).toEqual(['Refinancing']);
  });

  it('honours the limit', () => {
    expect(searchIndex(index, 'e', 2)).toHaveLength(2);
  });
});

describe('groupResults', () => {
  it('groups in a fixed order and drops empty groups', () => {
    const index = buildIndex([client('a', 'Acme')], user('admin'));
    const groups = groupResults(searchIndex(index, ''));
    expect(groups.map((g) => g.kind)).toEqual(['page', 'client']);
  });
});
