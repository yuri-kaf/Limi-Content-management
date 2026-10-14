import { badgeBtn, input } from './ui';

describe('input', () => {
  // An invalid field keeps its red edge, but a focused invalid field must still
  // look focused (WCAG 2.4.7). The red ring is `!`, so the focus ring on an
  // invalid field has to be too, and more specific: aria-[invalid=true] plus
  // focus-visible. It sits on a canvas-coloured offset, outside the red edge.
  it('shows keyboard focus on an invalid field, outside its red edge', () => {
    const classes = input.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining([
      'aria-[invalid=true]:!border-brand-text',
      'aria-[invalid=true]:focus-visible:!ring-2',
      'aria-[invalid=true]:focus-visible:!ring-focus',
      'dark:aria-[invalid=true]:focus-visible:!ring-focus-dark',
      'aria-[invalid=true]:focus-visible:ring-offset-2',
      'aria-[invalid=true]:focus-visible:ring-offset-canvas',
      'dark:aria-[invalid=true]:focus-visible:ring-offset-canvas-dark',
    ]));
  });
});

describe('badgeBtn', () => {
  // 36px to look at on a touch screen, 44px to hit: a transparent ::before
  // reaches 4px past each edge. The badge is always positioned (absolute) by
  // its user, which is what anchors the ::before.
  it('extends its touch target to 44px without growing', () => {
    const classes = badgeBtn.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining([
      '[@media(hover:none)]:w-9', '[@media(hover:none)]:h-9',
      "[@media(hover:none)]:before:content-['']",
      '[@media(hover:none)]:before:absolute', '[@media(hover:none)]:before:-inset-1',
    ]));
    expect(classes).not.toContain('relative');
  });
});

