// Every colour in a component comes from a token file: tailwind.config.js,
// src/ui.ts, STAGES in src/utils.ts, src/folderColors.ts, src/stageColors.ts.
// A literal in a component is how the old UI drifted into 290 of them, so this
// fails on one. Test files may hold literals: they assert the palettes.
const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// A 3-, 6- or 8-digit hex colour not preceded by `&` or a word character (so
// `&#8203;` is not a colour), or one of the retired neutral-* utilities.
const RAW = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|\bneutral-\d{2,3}\b/g;

const components = Object.entries(sources).filter(([path]) => !path.endsWith('.test.tsx'));

describe('components use tokens, not raw colours', () => {
  it('finds the components', () => {
    expect(components.length).toBeGreaterThan(40);
  });

  it.each(components)('%s has no raw colour', (_path, source) => {
    expect(source.match(RAW) ?? []).toEqual([]);
  });
});
