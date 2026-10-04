import { contrastRatio } from './color';
import {
  DEFAULT_FOLDER_COLOR, FOLDER_COLORS, folderColor, folderColorVars, folderTint, swatchTick,
} from './folderColors';

const AA = 4.5;

describe('folder colours', () => {
  it('offers the ten macOS-style colours, in picker order', () => {
    expect(FOLDER_COLORS.map((c) => c.id)).toEqual([
      'blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'graphite',
    ]);
  });

  it.each(FOLDER_COLORS)('$label label is readable in light mode', (c) => {
    expect(contrastRatio(c.text, c.tint)).toBeGreaterThanOrEqual(AA);
  });

  it.each(FOLDER_COLORS)('$label label is readable in dark mode', (c) => {
    expect(contrastRatio(c.textDark, c.tintDark)).toBeGreaterThanOrEqual(AA);
  });

  it.each(FOLDER_COLORS)('$label folder emblem reads on its front panel', (c) => {
    // The emblem is large text and decorative (the name is always beside the
    // folder), so the large-text bar of 3:1 applies.
    expect(contrastRatio(c.emblem, c.front)).toBeGreaterThanOrEqual(3);
  });

  it('puts a white tick on dark swatches and an ink tick on light ones', () => {
    expect(swatchTick('#3b82f6')).toBe('white');
    expect(swatchTick('#eab308')).toBe('ink');
  });

  it('falls back to blue for a missing or unknown value', () => {
    expect(DEFAULT_FOLDER_COLOR).toBe('blue');
    expect(folderColor(undefined).id).toBe('blue');
    expect(folderColor('chartreuse').id).toBe('blue');
    expect(folderColor('pink').id).toBe('pink');
  });

  it('sets every custom property the tint classes read', () => {
    // Renaming one side without the other would silently un-colour every label.
    const read = [...folderTint.matchAll(/var\((--fc-[a-z-]+)\)/g)].map((m) => m[1]);
    const set = Object.keys(folderColorVars('green'));
    expect(read.length).toBeGreaterThan(0);
    for (const name of read) expect(set).toContain(name);
  });

  it('exposes both theme pairs as custom properties', () => {
    const vars = folderColorVars('green') as Record<string, string>;
    expect(vars['--fc-tint']).toBe('#e3f8ea');
    expect(vars['--fc-text']).toBe('#166534');
    expect(vars['--fc-tint-dark']).toBe('#12301d');
    expect(vars['--fc-text-dark']).toBe('#86efac');
  });
});
