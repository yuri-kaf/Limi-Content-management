import { NO_CAMPAIGN, businessIdOf, campaignIdOf, scopeContent } from './campaigns';
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
