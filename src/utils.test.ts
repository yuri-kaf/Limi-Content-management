
describe('isInternalStage', () => {
  it('keeps Editing and Backup away from clients, and nothing else', async () => {
    const { isInternalStage } = await import('./utils');
    expect(['editing', 'backup'].every((s) => isInternalStage(s as never))).toBe(true);
    expect(['review', 'to-post', 'posted'].some((s) => isInternalStage(s as never))).toBe(false);
  });
});

describe('openLabel', () => {
  it('names a service, but never says "Open in Image"', async () => {
    const { openLabel } = await import('./utils');
    expect(openLabel({ provider: 'drive', label: 'Google Drive' })).toBe('Open in Google Drive');
    expect(openLabel({ provider: 'image', label: 'Image' })).toBe('Open image');
    expect(openLabel({ provider: 'other', label: 'Link' })).toBe('Open link');
  });
});
