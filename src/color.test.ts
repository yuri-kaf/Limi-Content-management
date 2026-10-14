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
  // `hover` too: every row, menu item and calendar day washes to it under the
  // pointer with its faint metadata still on it.
  const light = { page: palette.canvas.DEFAULT, tint: palette.tint.DEFAULT, hover: palette.hover.DEFAULT };
  const dark = { page: palette.canvas.dark, tint: palette.tint.dark, hover: palette.hover.dark };

  const lightTiers = [palette.ink.DEFAULT, palette.ink.soft, palette.ink.faint];
  const darkTiers = [palette.ink.dark, palette.ink.softdark, palette.ink.faintdark];

  it.each(lightTiers)('light ink tier %s clears AA on page, tint and hover', (tier) => {
    expect(contrastRatio(tier, light.page)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, light.tint)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, light.hover)).toBeGreaterThanOrEqual(AA);
  });

  it.each(darkTiers)('dark ink tier %s clears AA on page, tint and hover', (tier) => {
    expect(contrastRatio(tier, dark.page)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, dark.tint)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(tier, dark.hover)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the three dark tiers visibly separated', () => {
    const [ink, soft, faint] = darkTiers.map((c) => contrastRatio(c, dark.page));
    expect(ink / soft).toBeGreaterThan(1.3);
    expect(soft / faint).toBeGreaterThan(1.3);
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

// WCAG 1.4.11: a focus indicator needs 3:1 against what it sits on. Focus is
// neutral ink, not the brand red, so it never reads as an error. It is drawn
// on canvas-coloured offsets, inset on tint and hover rows, and inset on the
// pastel stage cards, so it has to clear all of them in each theme.
describe('focus ring meets WCAG non-text contrast', () => {
  const NON_TEXT = 3;

  it('is not the brand red', () => {
    expect(palette.focus.DEFAULT).not.toBe(palette.brand.DEFAULT);
    expect(palette.focus.dark).not.toBe(palette.brand.textdark);
  });

  it('clears 3:1 on every light ground', () => {
    for (const ground of [
      palette.canvas.DEFAULT, palette.surface.DEFAULT, palette.tint.DEFAULT, palette.hover.DEFAULT,
      ...STAGES.map((s) => s.cardTint),
    ]) {
      expect(contrastRatio(palette.focus.DEFAULT, ground)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  it('clears 3:1 on every dark ground', () => {
    for (const ground of [
      palette.canvas.dark, palette.surface.dark, palette.tint.dark, palette.hover.dark,
      ...STAGES.map((s) => s.cardTintDark),
    ]) {
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
  // text. ink-faint is never used on a card: it measures 4.4:1 on the Editing
  // tint, under AA, and only just clears it on the others.
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

// In dark mode a board card brightens to 110% under the pointer
// (`dark:hover:brightness-110` in ContentCard). The filter scales the whole
// card, text included, so both sides of each pair are brightened here, by
// scaling the sRGB channels, which is what brightness() does, clamped at 255.
function brighten(hex: string, by: number): string {
  const h = hex.replace('#', '');
  return '#' + [0, 2, 4]
    .map((i) => Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * by)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}

describe('stage cards stay AA under the dark hover', () => {
  it('brightens by scaling each channel', () => {
    expect(brighten('#102030', 1.1)).toBe('#122335');
    expect(brighten('#f0f0f0', 1.1)).toBe('#ffffff');
  });

  it.each(STAGES)('$label card is readable brightened 110%', (stage) => {
    const tint = brighten(stage.cardTintDark, 1.1);
    for (const text of [palette.ink.dark, palette.ink.softdark, stage.cardTextDark]) {
      expect(contrastRatio(brighten(text, 1.1), tint)).toBeGreaterThanOrEqual(AA);
    }
  });
});
