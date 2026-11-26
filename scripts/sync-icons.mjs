// Rewrites the Material Symbols icon_names list in index.html (and the visual
// harness page, when present) from the glyphs in src/icons.tsx, so the font
// always carries exactly the icons the app draws. Run after adding an icon:
//   node scripts/sync-icons.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const src = readFileSync('src/icons.tsx', 'utf8');
const map = src.match(/const MAP = \{([\s\S]*?)\} as const/)[1];
const names = [...new Set([...map.matchAll(/:\s*'([a-z_0-9]+)'/g)].map((m) => m[1]))].sort();
const list = names.join(',');

for (const file of ['index.html', '.superpowers/app-harness/index.html']) {
  if (!existsSync(file)) continue;
  const html = readFileSync(file, 'utf8');
  const next = html.replace(/icon_names=[a-z_0-9,]+/, `icon_names=${list}`);
  if (next !== html) writeFileSync(file, next);
  console.log(`${file}: ${names.length} icons`);
}
