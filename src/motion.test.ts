import { enter, staggerStyle } from './motion';
import { modalPanel, sheetPanel, sheetPanelWide } from './ui';

describe('staggerStyle', () => {
  it('starts each item a little after the one before', () => {
    expect(staggerStyle(0).animationDelay).toBe('0ms');
    expect(staggerStyle(1).animationDelay).toBe('30ms');
    expect(staggerStyle(3).animationDelay).toBe('90ms');
  });

  it('stops growing after twelve steps, so a long list is never kept waiting', () => {
    expect(staggerStyle(12).animationDelay).toBe('360ms');
    expect(staggerStyle(50).animationDelay).toBe('360ms');
  });

  it('treats a negative index as the first', () => {
    expect(staggerStyle(-1).animationDelay).toBe('0ms');
  });

  it('pairs with the fade-up entrance', () => {
    expect(enter).toBe('animate-fade-up');
  });
});

describe('dialog panels', () => {
  // Safari drops a panel's compositing layer the moment its entrance ends and
  // re-rasterises it under the blurred overlay, which shows as a dip of a
  // pixel or two. Promoting the panel for good keeps it on one layer.
  it.each(Object.entries({ modalPanel, sheetPanel, sheetPanelWide }))(
    '%s stays on its own layer after its entrance',
    (_name, recipe) => {
      expect(recipe).toContain('[will-change:transform,opacity]');
    }
  );
});
