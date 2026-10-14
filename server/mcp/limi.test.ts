// @vitest-environment node
import { FirestoreError } from './firestore.js';
import {
  findContent, getProfile, kathmanduIso, kathmanduText, LimiError, listClients, loadComments, loadIdeas,
  loadWorkspace, parseWhen, pick, plainMessage,
} from './limi.js';
import { at, limiGoogle, sessionAs } from './testData.js';

describe('getProfile', () => {
  it('reads the profile that grants a role', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    expect(session.profile).toMatchObject({ id: 'cli1', role: 'client', assignedClientIds: ['shopit', 'gone'] });
  });

  it('is null for an account with no profile', async () => {
    const google = limiGoogle();
    const { fs } = await sessionAs(google, 'admin1');
    expect(await getProfile(fs, 'ghost')).toBeNull();
  });
});

describe('listClients', () => {
  it('lists every client for the team, oldest first', async () => {
    const session = await sessionAs(limiGoogle(), 'admin1');
    expect((await listClients(session)).map((c) => c.name)).toEqual(['Shopit', 'Everest IT']);
  });

  it('reads only the assigned clients, by id, for a client login', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    google.calls.length = 0;
    const clients = await listClients(session);
    expect(clients.map((c) => c.id)).toEqual(['shopit']);
    // No attempt to list the collection, which the rules refuse to a client.
    expect(google.calls).toEqual([
      { op: 'get', path: 'clients/shopit' },
      { op: 'get', path: 'clients/gone' },
    ]);
  });

  it('never surfaces the legacy content array', async () => {
    const session = await sessionAs(limiGoogle(), 'admin1');
    const [shopit] = await listClients(session);
    expect(shopit).not.toHaveProperty('content');
  });
});

describe('loadWorkspace', () => {
  it('loads content, businesses and campaigns per client', async () => {
    const session = await sessionAs(limiGoogle(), 'admin1');
    const [shopit, everest] = await loadWorkspace(session);
    expect(shopit.content.map((i) => i.id)).toEqual(['momo', 'dashain', 'draft', 'offer']);
    expect(shopit.businesses.map((b) => b.id)).toEqual(['main', 'nepal']);
    expect(shopit.campaigns.map((c) => c.name)).toEqual(['Tihar 2026']);
    expect(everest.content.map((i) => i.id)).toEqual(['laptop']);
  });

  it('hides work still in Editing from a client', async () => {
    const session = await sessionAs(limiGoogle(), 'cli1');
    const workspace = await loadWorkspace(session);
    expect(workspace.map((c) => c.id)).toEqual(['shopit']);
    expect(workspace[0].content.map((i) => i.id)).toEqual(['momo', 'dashain', 'offer']);
  });
});

describe('comments and ideas', () => {
  it('reads a post thread oldest first', async () => {
    const session = await sessionAs(limiGoogle(), 'cli1');
    expect((await loadComments(session, 'shopit', 'momo')).map((c) => c.id)).toEqual(['c0', 'c1']);
  });

  it('reads ideas newest first', async () => {
    const session = await sessionAs(limiGoogle(), 'cli1');
    expect((await loadIdeas(session, 'shopit')).map((i) => i.id)).toEqual(['i2', 'i1']);
  });
});

describe('findContent', () => {
  it('finds a post across clients, or says it cannot', async () => {
    const workspace = await loadWorkspace(await sessionAs(limiGoogle(), 'admin1'));
    expect(findContent(workspace, 'laptop').client.id).toBe('everest');
    expect(() => findContent(workspace, 'nope')).toThrow("No such post (or you can't see it).");
  });
});

describe('pick', () => {
  const clients = [
    { id: 'shopit', name: 'Shopit' },
    { id: 'shopit-nepal', name: 'Shopit Nepal' },
    { id: 'everest', name: 'Everest IT' },
  ];

  it('prefers an exact id or name', () => {
    expect(pick(clients, 'shopit', 'client').id).toBe('shopit');
    expect(pick(clients, 'everest it', 'client').id).toBe('everest');
  });

  it('accepts a single partial match', () => {
    expect(pick(clients, 'ever', 'client').id).toBe('everest');
  });

  it('asks back when the name is ambiguous or unknown', () => {
    expect(() => pick(clients, 'shop', 'client')).toThrow(
      'Several clients match "shop": Shopit, Shopit Nepal. Which one?'
    );
    expect(() => pick(clients, 'Momo', 'client')).toThrow(
      'No client matches "Momo". The clients you can see: Shopit, Shopit Nepal, Everest IT.'
    );
  });
});

describe('dates', () => {
  it('reads a day or a day and time as Kathmandu local time', () => {
    expect(parseWhen('2026-10-20')).toBe(at(10, 20));
    expect(parseWhen('2026-10-20 15:30')).toBe(at(10, 20, 15, 30));
    expect(parseWhen('2026-10-20T09:05')).toBe(at(10, 20, 9, 5));
  });

  it('refuses anything else', () => {
    expect(() => parseWhen('next Tuesday')).toThrow(LimiError);
    expect(() => parseWhen('2026-02-30')).toThrow(LimiError);
    expect(() => parseWhen('2026-10-20 25:00')).toThrow(LimiError);
  });

  it('writes a time both ways', () => {
    expect(kathmanduIso(at(10, 16, 15))).toBe('2026-10-16T15:00+05:45');
    expect(kathmanduText(at(10, 16, 15))).toBe('Fri 16 Oct 2026, 3:00 PM');
    expect(kathmanduText(at(10, 16, 0, 5))).toBe('Fri 16 Oct 2026, 12:05 AM');
  });
});

describe('plainMessage', () => {
  it('turns a rules refusal into the plain sentence', () => {
    expect(plainMessage(new FirestoreError(403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.'))).toBe(
      "Your Limi role can't do that."
    );
  });

  it('turns a missing document into the plain sentence', () => {
    expect(plainMessage(new FirestoreError(404, 'NOT_FOUND', 'x'))).toBe("No such post (or you can't see it).");
  });

  it('never shows an internal error', () => {
    expect(plainMessage(new TypeError('cannot read properties of undefined'))).toBe(
      'Something went wrong in Limi. Try again in a moment.'
    );
  });

  it('a refused read from Firestore reaches the person as the plain sentence', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    const err = await session.fs.list('clients/everest/content').catch((e: unknown) => e);
    expect(plainMessage(err)).toBe("Your Limi role can't do that.");
  });
});
