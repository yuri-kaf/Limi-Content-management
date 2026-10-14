import { input } from './ui';

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
