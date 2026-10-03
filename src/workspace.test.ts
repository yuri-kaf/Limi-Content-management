import { campaignPath, parseTab, resolveScope, tabsFor, workspacePath } from './workspace';

describe('tabsFor', () => {
  it('gives the team every tab', () => {
    expect(tabsFor('admin').map((t) => t.id))
      .toEqual(['overview', 'content', 'campaigns', 'calendar', 'ideas']);
    expect(tabsFor('social-media-manager')).toHaveLength(5);
  });

  it('gives a client the three views they already had', () => {
    expect(tabsFor('client').map((t) => t.id)).toEqual(['content', 'calendar', 'ideas']);
  });

  it('gives a role that has not loaded only the client views', () => {
    expect(tabsFor(undefined).map((t) => t.id)).toEqual(['content', 'calendar', 'ideas']);
  });
});

describe('parseTab', () => {
  it('accepts a tab the role can see', () => {
    expect(parseTab('campaigns', tabsFor('admin'))).toBe('campaigns');
  });

  it('falls back to content for a missing, unknown or forbidden tab', () => {
    expect(parseTab(undefined, tabsFor('admin'))).toBe('content');
    expect(parseTab('nonsense', tabsFor('admin'))).toBe('content');
    expect(parseTab('overview', tabsFor('client'))).toBe('content');
  });
});

describe('paths', () => {
  it('keeps the bare client URL for the default tab, so existing links still land there', () => {
    expect(workspacePath('acme', 'content')).toBe('/client/acme');
  });

  it('adds the tab and the business scope', () => {
    expect(workspacePath('acme', 'calendar', 'b2')).toBe('/client/acme/calendar?b=b2');
  });

  it('builds campaign links', () => {
    expect(campaignPath('acme', 'c1')).toBe('/client/acme/campaign/c1');
    expect(campaignPath('acme', 'c1', 'b1')).toBe('/client/acme/campaign/c1?b=b1');
  });
});

describe('resolveScope', () => {
  const two = [{ id: 'b1' }, { id: 'b2' }];

  it('returns a business the client has', () => {
    expect(resolveScope('b2', two)).toBe('b2');
  });

  it('drops a business the client does not have', () => {
    expect(resolveScope('gone', two)).toBeUndefined();
  });

  it('drops any scope when there is only one business', () => {
    expect(resolveScope('b1', [{ id: 'b1' }])).toBeUndefined();
  });

  it('is undefined with no parameter', () => {
    expect(resolveScope(null, two)).toBeUndefined();
  });
});
