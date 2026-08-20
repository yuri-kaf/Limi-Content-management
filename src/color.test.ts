import { contrastRatio, relativeLuminance } from './color';
// @ts-expect-error -- tailwind.config.js is plain JS with no type declarations
import twConfig from '../tailwind.config.js';
import { STAGES } from './utils';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('accepts values with or without the leading hash', () => {
    expect(relativeLuminance('fff')).toBeCloseTo(relativeLuminance('#ffffff'), 5);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is 1 for a colour against itself', () => {
    expect(contrastRatio('#37352f', '#37352f')).toBeCloseTo(1, 5);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio('#37352f', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#37352f'),
      5
    );
  });
});

const palette = (twConfig as any).theme.extend.colors;
const AA = 4.5;

describe('palette meets WCAG AA', () => {
  const light = { page: palette.canvas.DEFAULT, tint: palette.tint.DEFAULT };
  const dark = { page: palette.canvas.dark, tint: palette.tint.dark };

  const lightTiers = [palette.ink.DEFAULT, palette.ink.soft, palette.ink.faint];
  const darkTiers = [palette.ink.dark, palette.ink.softdark, palette.ink.faintdark];

  it.each(lightTiers)('light ink tier %s clears AA on page and tint', (tier) => {
    expect(contrastRatio(tier, light.page)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, light.tint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(darkTiers)('dark ink tier %s clears AA on page and tint', (tier) => {
    expect(contrastRatio(tier, dark.page)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, dark.tint)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the three light tiers visibly separated', () => {
    const [ink, soft, faint] = lightTiers.map((c) => contrastRatio(c, light.page));
    expect(ink / soft).toBeGreaterThan(1.3);
    expect(soft / faint).toBeGreaterThan(1.3);
  });
});

describe('stage pills meet WCAG AA', () => {
  it('covers all four stages', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['editing', 'review', 'to-post', 'posted']);
  });

  it.each(STAGES)('$label pill is readable in light mode', (stage) => {
    expect(contrastRatio(stage.text, stage.tint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(STAGES)('$label pill is readable in dark mode', (stage) => {
    expect(contrastRatio(stage.textDark, stage.tintDark)).toBeGreaterThanOrEqual(AA);
  });
});
