// btnIcon and btnGhost set their own hover colours, in both themes. A plain
// `hover:text-*` or `hover:bg-*` stacked on them in a component competes with
// those by stylesheet order, not by class order, and usually loses — the
// delete button that never turned red. Overrides must use `!`, or a recipe
// built for the job (btnIconDanger, btnGhostDanger).
const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const components = Object.entries(sources).filter(([path]) => !path.endsWith('.test.tsx'));

// `${btnIcon}` or `${btnGhost}` then, inside the same template literal, a
// hover colour without `!`.
const STACKED = /\$\{(?:btnIcon|btnGhost)\}[^`]*?(?:dark:)?hover:(?:text|bg|border)-[\w/-]+/g;

describe('recipe hover overrides', () => {
  it('catches a plain hover colour stacked on btnIcon', () => {
    expect('`${btnIcon} hover:text-brand-text`'.match(STACKED)).not.toBeNull();
    expect('`${btnGhost} flex-1 dark:hover:bg-hover-dark`'.match(STACKED)).not.toBeNull();
    expect('`${btnIcon} hover:!text-brand-text`'.match(STACKED)).toBeNull();
    expect('`${btnIcon} absolute top-1`'.match(STACKED)).toBeNull();
  });

  it.each(components)('%s overrides recipe hovers only with !', (_path, source) => {
    expect(source.match(STACKED) ?? []).toEqual([]);
  });
});
