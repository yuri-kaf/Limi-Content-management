// Every colour in a component comes from a token file: tailwind.config.js,
// src/ui.ts, STAGES in src/utils.ts, src/folderColors.ts, src/stageColors.ts.
// A literal in a component is how the old UI drifted into 290 of them, so this
// fails on one. Test files may hold literals: they assert the palettes.
//
// Banned in a component:
// - a hex colour of 3, 4, 6 or 8 digits, not preceded by `&` or a word
//   character (so `&#8203;` is not a colour);
// - rgb()/rgba()/hsl()/hsla(), including inside an arbitrary value;
// - a Tailwind palette utility such as emerald-600 or neutral-200: the tested
//   tokens (success, warning, info, brand, ink, stage) replace them;
// - a bare `bg-white`, which is `bg-surface`. Translucent washes on the pastel
//   cards (`bg-white/60`) and `text-white` on a solid fill stay allowed.
const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
const FUNCTION = /(?<![a-zA-Z])(?:rgba?|hsla?)\(/;
const PALETTE =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
const BARE_WHITE = /\bbg-white(?![\w/-])/;

const RAW = new RegExp([HEX, FUNCTION, PALETTE, BARE_WHITE].map((r) => r.source).join('|'), 'g');

const components = Object.entries(sources).filter(([path]) => !path.endsWith('.test.tsx'));

describe('the raw-colour pattern', () => {
  it.each([
    '#fff', '#ffff', '#ffffff', '#ffffff80', 'rgba(0,0,0,.5)', 'shadow-[0_1px_rgb(1,2,3)]',
    'hsl(0 0% 0%)', 'text-emerald-700', 'dark:bg-amber-950/40', 'text-red-400', 'bg-sky-50',
    'border-neutral-200', 'bg-white', 'hover:bg-white ',
  ])('catches %s', (sample) => {
    expect(sample.match(RAW)).not.toBeNull();
  });

  it.each([
    '&#8203;', 'bg-white/60', 'text-white', 'bg-surface', 'text-brand-text', 'bg-success-soft',
    'text-stage-review', 'max-w-[1440px]',
  ])('lets %s through', (sample) => {
    expect(sample.match(RAW)).toBeNull();
  });
});

describe('components use tokens, not raw colours', () => {
  it('finds the components', () => {
    expect(components.length).toBeGreaterThan(40);
  });

  it.each(components)('%s has no raw colour', (_path, source) => {
    expect(source.match(RAW) ?? []).toEqual([]);
  });
});
