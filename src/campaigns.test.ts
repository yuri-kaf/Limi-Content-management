import {
  NO_CAMPAIGN, businessDeleteBlocker, businessIdOf, businessSummary, campaignIdOf,
  campaignProgress, campaignStatusMeta, defaultBusinessFor, deliverableProgress,
  planBusinessMigration, scopeContent, sortCampaigns, unslottedContent,
} from './campaigns';
import { Business, Campaign, ContentItem } from './types';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 't', driveLink: '', driveFileId: '', status: 'editing',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function business(id: string, createdAt = 1): Business {
  return { id, name: id.toUpperCase(), color: 'blue', about: '', createdAt };
}

function campaign(id: string, over: Partial<Campaign> = {}): Campaign {
  return {
    id, businessId: 'b1', name: id, brief: '', status: 'live', color: 'green',
    deliverables: [], createdAt: 1, ...over,
  };
}

const B1 = business('b1');
const B2 = business('b2', 2);

describe('businessIdOf', () => {
  it('uses the stored business', () => {
    expect(businessIdOf(item({ businessId: 'b2' }), [B1, B2])).toBe('b2');
  });

  it('puts an item from before businesses existed in the first business', () => {
    expect(businessIdOf(item(), [B1, B2])).toBe('b1');
  });

  it('is undefined while the client has no business yet', () => {
    expect(businessIdOf(item(), [])).toBeUndefined();
  });
});

describe('campaignIdOf', () => {
  it('returns a campaign that exists', () => {
    expect(campaignIdOf(item({ campaignId: 'c1' }), [campaign('c1')])).toBe('c1');
  });

  it('ignores a campaign that was deleted', () => {
    expect(campaignIdOf(item({ campaignId: 'gone' }), [campaign('c1')])).toBeUndefined();
  });
});

describe('scopeContent', () => {
  const content = [
    item({ id: 'legacy' }),
    item({ id: 'b1-free', businessId: 'b1' }),
    item({ id: 'b1-c1', businessId: 'b1', campaignId: 'c1' }),
    item({ id: 'b2-c2', businessId: 'b2', campaignId: 'c2' }),
    item({ id: 'dangling', businessId: 'b2', campaignId: 'deleted' }),
  ];
  const campaigns = [campaign('c1'), campaign('c2', { businessId: 'b2' })];
  const ids = (scope: Parameters<typeof scopeContent>[1]) =>
    scopeContent(content, scope, [B1, B2], campaigns).map((i) => i.id);

  it('returns everything with no scope', () => {
    expect(ids({})).toHaveLength(5);
  });

  it('scopes to a business, counting legacy items as the first business', () => {
    expect(ids({ businessId: 'b1' })).toEqual(['legacy', 'b1-free', 'b1-c1']);
    expect(ids({ businessId: 'b2' })).toEqual(['b2-c2', 'dangling']);
  });

  it('scopes to one campaign', () => {
    expect(ids({ campaignId: 'c2' })).toEqual(['b2-c2']);
  });

  it('treats a deleted campaign as no campaign', () => {
    expect(ids({ campaignId: NO_CAMPAIGN })).toEqual(['legacy', 'b1-free', 'dangling']);
  });

  it('combines business and campaign', () => {
    expect(ids({ businessId: 'b2', campaignId: NO_CAMPAIGN })).toEqual(['dangling']);
  });
});

describe('deliverable and campaign progress', () => {
  const reels = { id: 'd-reels', label: 'Reels', mediaType: 'video' as const, target: 3 };
  const carousels = { id: 'd-car', label: 'Carousels', mediaType: 'graphic' as const, target: 2 };
  const summer = campaign('c1', { deliverables: [reels, carousels] });

  const content = [
    item({ id: 'r1', campaignId: 'c1', deliverableId: 'd-reels', status: 'posted', createdAt: 2 }),
    item({ id: 'r2', campaignId: 'c1', deliverableId: 'd-reels', status: 'review', createdAt: 1 }),
    item({ id: 'loose', campaignId: 'c1', status: 'posted' }),
    item({ id: 'orphan', campaignId: 'c1', deliverableId: 'removed', status: 'editing' }),
    item({ id: 'other', campaignId: 'c2', deliverableId: 'd-reels', status: 'posted' }),
  ];

  it('counts linked and posted items per deliverable, oldest first', () => {
    const [r, c] = deliverableProgress(summer, content);
    expect(r.items.map((i) => i.id)).toEqual(['r2', 'r1']);
    expect(r.posted).toBe(1);
    expect(c.items).toHaveLength(0);
  });

  it('treats items with no deliverable, or a removed one, as unslotted', () => {
    expect(unslottedContent(summer, content).map((i) => i.id)).toEqual(['loose', 'orphan']);
  });

  it('plans every target plus unslotted items, and counts every posted item', () => {
    // 3 reels + 2 carousels + 2 unslotted = 7 planned; r1 and loose are posted.
    expect(campaignProgress(summer, content)).toEqual({ posted: 2, planned: 7, ratio: 2 / 7 });
  });

  it('lets a deliverable run over its target without passing 100%', () => {
    const one = campaign('c1', { deliverables: [{ id: 'd', label: 'Post', target: 1 }] });
    const made = [1, 2, 3].map((n) =>
      item({ id: `p${n}`, campaignId: 'c1', deliverableId: 'd', status: 'posted' })
    );
    expect(campaignProgress(one, made)).toEqual({ posted: 3, planned: 3, ratio: 1 });
  });

  it('is zero, not NaN, for an empty campaign', () => {
    expect(campaignProgress(campaign('c1'), [])).toEqual({ posted: 0, planned: 0, ratio: 0 });
  });
});

describe('campaign status', () => {
  it('names and colours each status', () => {
    expect(campaignStatusMeta('live')).toMatchObject({ label: 'Live', color: 'green' });
    expect(campaignStatusMeta('planning')).toMatchObject({ label: 'Planning', color: 'graphite' });
    expect(campaignStatusMeta('completed')).toMatchObject({ label: 'Completed', color: 'blue' });
  });

  it('orders live, planning, completed, then by start date with undated last', () => {
    const sorted = sortCampaigns([
      campaign('done', { status: 'completed' }),
      campaign('plan-undated', { status: 'planning' }),
      campaign('plan-late', { status: 'planning', startDate: '2026-11-01' }),
      campaign('plan-early', { status: 'planning', startDate: '2026-10-01' }),
      campaign('live', { status: 'live' }),
    ]);
    expect(sorted.map((c) => c.id))
      .toEqual(['live', 'plan-early', 'plan-late', 'plan-undated', 'done']);
  });
});

describe('businessSummary', () => {
  it('counts content, review waits and unfinished campaigns for one business', () => {
    const content = [
      item({ id: 'a', status: 'review' }), // no businessId, so the first business
      item({ id: 'b', businessId: 'b1', status: 'posted' }),
      item({ id: 'c', businessId: 'b2', status: 'review' }),
    ];
    const campaigns = [
      campaign('live', { businessId: 'b1', status: 'live' }),
      campaign('plan', { businessId: 'b1', status: 'planning' }),
      campaign('done', { businessId: 'b1', status: 'completed' }),
      campaign('other', { businessId: 'b2' }),
    ];
    expect(businessSummary('b1', [B1, B2], content, campaigns)).toEqual({
      total: 2, awaitingReview: 1, activeCampaigns: 2,
    });
  });
});

describe('businessDeleteBlocker', () => {
  it('never allows deleting the last business', () => {
    expect(businessDeleteBlocker('b1', [B1], [], [])).toMatch(/at least one business/);
  });

  it('never allows deleting the first business, which holds everything unfiled', () => {
    expect(businessDeleteBlocker('b1', [B1, B2], [], [])).toMatch(/first business/);
  });

  it('blocks while the business holds content', () => {
    expect(businessDeleteBlocker('b2', [B1, B2], [item({ businessId: 'b2' })], []))
      .toMatch(/1 content item/);
  });

  it('blocks while the business has campaigns', () => {
    expect(businessDeleteBlocker('b2', [B1, B2], [], [{ businessId: 'b2' }, { businessId: 'b2' }]))
      .toMatch(/2 campaigns/);
  });

  it('allows deleting an empty business', () => {
    expect(businessDeleteBlocker('b2', [B1, B2], [item({ businessId: 'b1' })], [])).toBeNull();
  });
});

describe('defaultBusinessFor', () => {
  it('names, colours and pictures the business after the client', () => {
    expect(
      defaultBusinessFor({ name: 'Acme', imageUrl: 'https://x/a.png', about: 'Hi', color: 'pink' }, 5)
    ).toEqual({ name: 'Acme', color: 'pink', logoUrl: 'https://x/a.png', about: 'Hi', createdAt: 5 });
  });

  it('omits the logo rather than writing undefined, which Firestore rejects', () => {
    const b = defaultBusinessFor({ name: 'Acme' }, 5);
    expect('logoUrl' in b).toBe(false);
    expect(b.color).toBe('blue');
    expect(b.about).toBe('');
  });
});

describe('planBusinessMigration', () => {
  const client = (id: string, content: ContentItem[], businesses: Business[]) =>
    ({ id, content, businesses });

  it('creates a default business and stamps every item for an unmigrated client', () => {
    expect(planBusinessMigration([client('a', [item({ id: 'x' }), item({ id: 'y' })], [])]))
      .toEqual([{ clientId: 'a', createDefault: true, contentIds: ['x', 'y'] }]);
  });

  it('stamps only the items still missing a business', () => {
    expect(planBusinessMigration([
      client('a', [item({ id: 'x', businessId: 'b1' }), item({ id: 'y' })], [B1]),
    ])).toEqual([{ clientId: 'a', createDefault: false, contentIds: ['y'] }]);
  });

  it('creates a business for a client with no content at all', () => {
    expect(planBusinessMigration([client('a', [], [])]))
      .toEqual([{ clientId: 'a', createDefault: true, contentIds: [] }]);
  });

  it('is empty once everything is migrated, so a second run does nothing', () => {
    expect(planBusinessMigration([client('a', [item({ businessId: 'b1' })], [B1])])).toEqual([]);
  });
});
