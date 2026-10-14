// @vitest-environment node
import { runTool, TOOLS } from './tools.js';
import { at, limiGoogle, NOW, sessionAs } from './testData.js';

type Google = ReturnType<typeof limiGoogle>;

async function call(name: string, args: Record<string, unknown> = {}, uid = 'admin1', google: Google = limiGoogle()) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  const session = await sessionAs(google, uid);
  // The SDK validates arguments against the schema before a tool runs.
  const result = await runTool(tool, session, tool.input.parse(args));
  const text = (result.content[0] as { text: string }).text;
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // a plain sentence
  }
  return { result, text, data: data as any, google };
}

describe('the tool list', () => {
  it('has the thirteen tools of the spec', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'whoami', 'list_clients', 'list_content', 'get_content', 'get_today', 'list_campaigns', 'list_ideas',
      'create_content', 'update_content', 'move_content', 'review_content', 'add_comment', 'add_idea',
    ]);
  });

  it('says on every write that it changes data', () => {
    for (const tool of TOOLS.filter((t) => !t.readOnly)) {
      expect(tool.description).toContain('This changes data in Limi');
    }
    expect(TOOLS.filter((t) => !t.readOnly)).toHaveLength(6);
  });
});

describe('whoami', () => {
  it('names the person, the role and the clients', async () => {
    const { data } = await call('whoami', {}, 'cli1');
    expect(data).toEqual({
      name: 'Sam Shopit', email: 'sam@shopit.test', role: 'client', clients: [{ id: 'shopit', name: 'Shopit' }],
    });
  });
});

describe('list_clients', () => {
  it('counts posts per stage', async () => {
    const { data } = await call('list_clients');
    expect(data[0]).toEqual({
      id: 'shopit',
      name: 'Shopit',
      businesses: [{ id: 'main', name: 'Shopit' }, { id: 'nepal', name: 'Shopit Nepal' }],
      stages: { Editing: 1, Review: 2, 'To Post': 1, Posted: 0 },
      awaitingReview: 1,
      overdue: 1,
    });
  });
});

describe('list_content', () => {
  it('finds what is overdue for a client', async () => {
    const { data } = await call('list_content', { client: 'shopit', when: 'overdue' });
    expect(data.total).toBe(1);
    expect(data.posts[0]).toMatchObject({
      id: 'dashain', title: 'Dashain recap', stage: 'To Post', late: true,
      scheduled: { iso: '2026-10-10T09:00+05:45', kathmandu: 'Sat 10 Oct 2026, 9:00 AM', relative: '4 days late' },
    });
  });

  it('filters by campaign, stage and review state', async () => {
    const { data } = await call('list_content', { campaign: 'tihar', needs_review: true });
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['momo']);
    expect(data.posts[0]).toMatchObject({ campaign: 'Tihar 2026', business: 'Shopit' });
  });

  it('filters by business', async () => {
    const { data } = await call('list_content', { business: 'Shopit Nepal' });
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['offer']);
  });

  it('searches titles and captions', async () => {
    const { data } = await call('list_content', { search: 'straight to you' });
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['momo']);
  });

  it('caps the list and reports the total', async () => {
    const { data } = await call('list_content', { limit: 2 });
    expect(data).toMatchObject({ total: 5, shown: 2 });
    // Scheduled soonest first.
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['laptop', 'dashain']);
  });

  it('shows a client nothing in Editing', async () => {
    const { data } = await call('list_content', {}, 'cli1');
    expect(data.posts.map((p: { id: string }) => p.id)).not.toContain('draft');
  });

  it('asks back about an unknown client', async () => {
    const { result, text } = await call('list_content', { client: 'Momo House' });
    expect(result.isError).toBe(true);
    expect(text).toBe('No client matches "Momo House". The clients you can see: Shopit, Everest IT.');
  });
});

describe('get_content', () => {
  it('returns every field, versions and the thread', async () => {
    const { data } = await call('get_content', { id: 'momo' });
    expect(data).toMatchObject({
      id: 'momo', title: 'Momo reel', business: 'Shopit', campaign: 'Tihar 2026', deliverable: '3 Reels',
      caption: 'Steaming momo, straight to you', hashtags: '#momo', platforms: ['instagram'],
      notes: 'Use the v2 music', media: { type: 'video', host: 'Google Drive' }, versions: [],
    });
    expect(data.comments.map((c: { body: string }) => c.body)).toEqual(['moved this to Review', 'Looks good']);
    expect(data.comments[1]).toMatchObject({ author: 'Sam Shopit', atSeconds: 12 });
  });

  it('keeps team notes from a client', async () => {
    const { data } = await call('get_content', { id: 'momo' }, 'cli1');
    expect(data).not.toHaveProperty('notes');
  });

  it('says plainly when a post cannot be seen', async () => {
    const { result, text } = await call('get_content', { id: 'laptop' }, 'cli1');
    expect(result.isError).toBe(true);
    expect(text).toBe("No such post (or you can't see it).");
  });
});

describe('get_today', () => {
  it('builds the queue', async () => {
    const { data } = await call('get_today');
    const ids = (group: { id: string }[]) => group.map((p) => p.id);
    expect(data.today).toBe('Wed 14 Oct 2026, 10:00 AM');
    expect(ids(data.needsReview)).toEqual(['momo']);
    expect(ids(data.needsRework)).toEqual(['offer']);
    expect(ids(data.goingOutSoon)).toEqual(['dashain', 'momo']);
    expect(ids(data.overdue)).toEqual(['dashain']);
  });
});

describe('list_campaigns', () => {
  it('reports progress, and the brief to the team', async () => {
    const { data } = await call('list_campaigns', { client: 'Shopit' });
    expect(data[0].campaigns[0]).toEqual({
      id: 'tihar', name: 'Tihar 2026', business: 'Shopit', status: 'Live', dates: 'Oct 20 – Nov 5',
      progress: '0 of 3 posted', deliverables: [{ label: '3 Reels', made: 1, posted: 0, planned: 3 }],
      brief: 'Internal: push the gift boxes',
    });
  });

  it('keeps the brief from a client', async () => {
    const { data } = await call('list_campaigns', {}, 'cli1');
    expect(data[0].campaigns[0]).not.toHaveProperty('brief');
  });
});

describe('list_ideas', () => {
  it('lists ideas, filtered by status', async () => {
    const { data } = await call('list_ideas', { client: 'Shopit', status: 'new' });
    expect(data).toEqual([
      {
        client: 'Shopit',
        ideas: [
          {
            id: 'i1', title: 'Tihar lights', description: 'Diyas at dusk', links: [], status: 'new',
            business: 'Shopit', by: 'Sam Shopit', created: expect.any(Object),
          },
        ],
      },
    ]);
  });
});

describe('create_content', () => {
  it('creates a post in Editing under the campaign business', async () => {
    const { data, google } = await call('create_content', {
      client: 'Shopit', title: 'Tihar teaser', campaign: 'Tihar', scheduled: '2026-10-20 18:00',
      link: 'https://example.com/teaser.png',
    });
    expect(data.created).toMatchObject({ title: 'Tihar teaser', stage: 'Editing', campaign: 'Tihar 2026' });
    const doc = google.doc(`clients/shopit/content/${data.created.id}`);
    expect(doc).toMatchObject({
      status: 'editing', businessId: 'main', campaignId: 'tihar', mediaType: 'graphic', scheduledAt: at(10, 20, 18),
    });
  });

  it('is refused to a client in plain words', async () => {
    const { result, text } = await call('create_content', { client: 'Shopit', title: 'Mine' }, 'cli1');
    expect(result.isError).toBe(true);
    expect(text).toBe("Your Limi role can't do that.");
  });

  it('refuses a date it cannot read', async () => {
    const { text } = await call('create_content', { client: 'Shopit', title: 'X', scheduled: 'next Friday' });
    expect(text).toContain('Use 2026-10-20 or 2026-10-20 15:30 (Kathmandu time).');
  });
});

describe('update_content', () => {
  it('appends a version when the link changes', async () => {
    const { text, google } = await call('update_content', {
      id: 'momo', link: 'https://www.youtube.com/watch?v=abcdefghijk',
    });
    expect(JSON.parse(text)).toEqual({
      updated: 'Momo reel', changed: ['driveLink', 'driveFileId'], note: 'Uploaded as v2.',
    });
    expect(google.doc('clients/shopit/content/momo')!.versions).toHaveLength(1);
  });

  it('unschedules on an empty date', async () => {
    const { google } = await call('update_content', { id: 'dashain', scheduled: '' });
    expect(google.doc('clients/shopit/content/dashain')!.scheduledAt).toBe(0);
  });
});

describe('move_content', () => {
  it('moves the post and notes it on the thread', async () => {
    const { text, google } = await call('move_content', { id: 'momo', stage: 'to-post' });
    expect(text).toBe('Moved Momo reel to To Post.');
    const ops = google.calls.filter((c) => c.op !== 'get' && c.op !== 'list');
    expect(ops.map((c) => c.op)).toEqual(['update', 'create']);
  });

  it("turns a Firestore refusal into Limi's plain message", async () => {
    const { result, text, google } = await call('move_content', { id: 'momo', stage: 'posted' }, 'cli1');
    expect(result.isError).toBe(true);
    expect(text).toBe("Your Limi role can't do that.");
    expect(google.doc('clients/shopit/content/momo')!.status).toBe('review');
  });
});

describe('review_content', () => {
  it('records a client decision with a note', async () => {
    const { text, google } = await call(
      'review_content', { id: 'momo', decision: 'approved', note: 'Lower the music' }, 'cli1'
    );
    expect(text).toBe('Marked Momo reel approved, with the note "Lower the music".');
    expect(google.doc('clients/shopit/content/momo')).toMatchObject({
      clientReview: 'approved', reviewNote: 'Lower the music',
    });
  });

  it('refuses a client acting on a post that left Review', async () => {
    const { text } = await call('review_content', { id: 'dashain', decision: 'declined' }, 'cli1');
    expect(text).toBe("Dashain recap isn't waiting for your review.");
  });
});

describe('add_comment', () => {
  it('comments at a moment in the video', async () => {
    const { text, google } = await call('add_comment', { id: 'momo', body: 'Cut here', at_seconds: 42 }, 'cli1');
    expect(text).toBe('Commented on Momo reel.');
    const added = google
      .paths('clients/shopit/content/momo/comments/')
      .map((p) => google.doc(p)!)
      .find((c) => c.createdAt === NOW);
    expect(added).toMatchObject({ kind: 'user', body: 'Cut here', atSeconds: 42 });
  });
});

describe('add_idea', () => {
  it('adds an idea for a business', async () => {
    const { text, google } = await call(
      'add_idea', { client: 'Shopit', title: 'Lantern reel', business: 'nepal' }, 'cli1'
    );
    expect(text).toBe('Added the idea "Lantern reel" for Shopit.');
    const ideas = google.paths('clients/shopit/ideas/').map((p) => google.doc(p)!);
    expect(ideas.find((i) => i.title === 'Lantern reel')).toMatchObject({ businessId: 'nepal', status: 'new' });
  });
});
