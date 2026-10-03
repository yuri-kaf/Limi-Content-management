import { contrastRatio } from './color';
import { DEFAULT_FOLDER_COLOR, FOLDER_COLORS, folderColor, folderColorVars } from './folderColors';

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

  it('falls back to blue for a missing or unknown value', () => {
    expect(DEFAULT_FOLDER_COLOR).toBe('blue');
    expect(folderColor(undefined).id).toBe('blue');
    expect(folderColor('chartreuse').id).toBe('blue');
    expect(folderColor('pink').id).toBe('pink');
  });

  it('exposes both theme pairs as custom properties', () => {
    const vars = folderColorVars('green') as Record<string, string>;
    expect(vars['--fc-tint']).toBe('#e3f8ea');
    expect(vars['--fc-text']).toBe('#166534');
    expect(vars['--fc-tint-dark']).toBe('#12301d');
    expect(vars['--fc-text-dark']).toBe('#86efac');
  });
});
