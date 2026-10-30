
describe('isInternalStage', () => {
  it('keeps Editing and Backup away from clients, and nothing else', async () => {
    const { isInternalStage } = await import('./utils');
    expect(['editing', 'backup'].every((s) => isInternalStage(s as never))).toBe(true);
    expect(['review', 'to-post', 'posted'].some((s) => isInternalStage(s as never))).toBe(false);
  });
});
