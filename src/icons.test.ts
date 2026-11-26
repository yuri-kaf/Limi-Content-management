import { readFileSync } from 'node:fs';
import { ICON_NAMES } from './icons';

// A glyph missing from the subset font renders as its ligature text, cut off
// in a 1em box. `node scripts/sync-icons.mjs` rewrites the list.
describe('icon font', () => {
  it('loads every glyph src/icons.tsx draws', () => {
    const html = readFileSync('index.html', 'utf8');
    const loaded = html.match(/icon_names=([a-z_0-9,]+)/)?.[1].split(',') ?? [];
    expect(loaded).toEqual(ICON_NAMES);
  });
});
