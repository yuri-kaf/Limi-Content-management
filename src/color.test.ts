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

describe('brand red as text meets WCAG AA', () => {
  // The brand red itself (#dc2626) is a fill colour: as text it measures 4.4:1
  // on brand-soft and 3.2 to 3.6:1 on the dark surfaces. Red words use the
  // text pair instead.
  const lightGrounds = {
    canvas: palette.canvas.DEFAULT,
    surface: palette.surface.DEFAULT,
    tint: palette.tint.DEFAULT,
    'brand-soft': palette.brand.soft,
  };
  const darkGrounds = {
    canvas: palette.canvas.dark,
    surface: palette.surface.dark,
    tint: palette.tint.dark,
    'brand-softdark': palette.brand.softdark,
  };

  it.each(Object.entries(lightGrounds))('brand-text clears AA on %s', (_name, ground) => {
    expect(contrastRatio(palette.brand.text, ground)).toBeGreaterThanOrEqual(AA);
  });

  it.each(Object.entries(darkGrounds))('brand-textdark clears AA on %s', (_name, ground) => {
    expect(contrastRatio(palette.brand.textdark, ground)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps white text readable on the brand fill', () => {
    expect(contrastRatio('#ffffff', palette.brand.DEFAULT)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio('#ffffff', palette.brand.hover)).toBeGreaterThanOrEqual(AA);
  });
});

// Success (approved, done), warning (caution, needs attention) and info (a
// neutral role tint). Each is a fill with white text, a soft tint, and a text
// colour that has to read on the page, the tint and its own soft wash.
describe.each(['success', 'warning'])('%s tokens meet WCAG AA', (name) => {
  const tone = () => palette[name];

  it('keeps white text readable on the fill and its hover', () => {
    expect(contrastRatio('#ffffff', tone().DEFAULT)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio('#ffffff', tone().hover)).toBeGreaterThanOrEqual(AA);
  });

  it('has light text that reads on canvas, surface, tint and its soft washes', () => {
    for (const ground of [
      palette.canvas.DEFAULT, palette.surface.DEFAULT, palette.tint.DEFAULT,
      tone().soft, tone().softhover,
    ]) {
      expect(contrastRatio(tone().text, ground)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('has dark text that reads on canvas, surface, tint and its soft washes', () => {
    for (const ground of [
      palette.canvas.dark, palette.surface.dark, palette.tint.dark,
      tone().softdark, tone().softhoverdark,
    ]) {
      expect(contrastRatio(tone().textdark, ground)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('keeps body ink readable on its soft wash', () => {
    expect(contrastRatio(palette.ink.soft, tone().soft)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(palette.ink.softdark, tone().softdark)).toBeGreaterThanOrEqual(AA);
  });
});

describe('info tokens meet WCAG AA', () => {
  it('reads on canvas, tint and its soft wash in both themes', () => {
    for (const ground of [palette.canvas.DEFAULT, palette.tint.DEFAULT, palette.info.soft]) {
      expect(contrastRatio(palette.info.text, ground)).toBeGreaterThanOrEqual(AA);
    }
    for (const ground of [palette.canvas.dark, palette.tint.dark, palette.info.softdark]) {
      expect(contrastRatio(palette.info.textdark, ground)).toBeGreaterThanOrEqual(AA);
    }
  });
});

// WCAG 1.4.11: a focus indicator needs 3:1 against what it sits on. The ring
// is drawn on a canvas-coloured offset, and on tint and hover where it is
// inset, so it has to clear all three in each theme.
describe('focus ring meets WCAG non-text contrast', () => {
  const NON_TEXT = 3;

  it('clears 3:1 on canvas, tint and hover in light mode', () => {
    for (const ground of [palette.canvas.DEFAULT, palette.tint.DEFAULT, palette.hover.DEFAULT]) {
      expect(contrastRatio(palette.focus.DEFAULT, ground)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  it('clears 3:1 on canvas, tint and hover in dark mode', () => {
    for (const ground of [palette.canvas.dark, palette.tint.dark, palette.hover.dark]) {
      expect(contrastRatio(palette.focus.dark, ground)).toBeGreaterThanOrEqual(NON_TEXT);
    }
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

describe('stage cards meet WCAG AA', () => {
  // A card's title is ink, its secondary text ink-soft, its chips the stage
  // text. ink-faint is never used on a card: it measures about 4.1 to 4.3:1 on
  // the light tints, and ink-faintdark 3.8 to 4.3:1 on the dark ones.
  it.each(STAGES)('$label card is readable in light mode', (stage) => {
    expect(contrastRatio(palette.ink.DEFAULT, stage.cardTint)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(palette.ink.soft, stage.cardTint)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(stage.cardText, stage.cardTint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(STAGES)('$label card is readable in dark mode', (stage) => {
    expect(contrastRatio(palette.ink.dark, stage.cardTintDark)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(palette.ink.softdark, stage.cardTintDark)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(stage.cardTextDark, stage.cardTintDark)).toBeGreaterThanOrEqual(AA);
  });
});
