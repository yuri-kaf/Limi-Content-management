// A button recipe sets its own size and hover colours. A plain utility for the
// same property stacked on it in a component competes by stylesheet order, not
// by class order, and usually loses: the delete button that never turned red,
// the toolbar buttons whose h-9 never applied because min-h-11 won. An
// override must use `!`, or better a recipe built for the job (btnIconDanger,
// btnGhostDanger, btnPrimarySm, btnGhostSm).
const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const components = Object.entries(sources).filter(([path]) => !path.endsWith('.test.tsx'));

// What each recipe owns. A class from the same family, without `!`, is dead or
// a coin toss.
const HOVER = /^(?:dark:)?hover:(?:text|bg|border)-/;
const OWNED: Record<string, RegExp[]> = {
  btnIcon: [HOVER, /^(?:w|h|min-w|min-h)-/],
  btnIconDanger: [HOVER, /^(?:w|h|min-w|min-h)-/],
  btnGhost: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnGhostDanger: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnPrimary: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnDanger: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnSuccess: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnSuccessSolid: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnPrimarySm: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnGhostSm: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  btnWarningSm: [HOVER, /^(?:h|min-h|px|py)-/, /^text-(?:xs|sm|base|\[\d)/],
  badgeBtn: [HOVER, /^(?:w|h|min-w|min-h)-/],
};

/**
 * The text of the template literal that `${recipe}` sits in, from just after
 * it to the literal's closing backtick, including any nested templates and
 * quoted strings inside its expressions (`${cond ? 'a' : `b`}`), but not the
 * rest of their JavaScript.
 */
function restOfTemplate(source: string, from: number): string {
  let out = '';
  // Each entry is what we are inside: a template literal or an expression.
  const stack: ('tpl' | 'expr')[] = ['tpl'];
  for (let i = from; i < source.length && stack.length; i++) {
    const ch = source[i];
    const top = stack[stack.length - 1];
    if (top === 'tpl') {
      if (ch === '`') stack.pop();
      else if (ch === '$' && source[i + 1] === '{') { stack.push('expr'); i++; out += ' '; }
      else out += ch;
    } else if (ch === '`') stack.push('tpl');
    else if (ch === "'" || ch === '"') {
      const end = source.indexOf(ch, i + 1);
      if (end < 0) break;
      out += ' ' + source.slice(i + 1, end) + ' ';
      i = end;
    } else if (ch === '{') stack.push('expr');
    else if (ch === '}') { stack.pop(); out += ' '; }
  }
  return out;
}

function stackedOverrides(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/\$\{(\w+)\}/g)) {
    const owned = OWNED[m[1]];
    if (!owned) continue;
    const classes = restOfTemplate(source, m.index! + m[0].length).split(/\s+/);
    for (const cls of classes) {
      if (cls && owned.some((re) => re.test(cls))) found.push(`${m[1]} + ${cls}`);
    }
  }
  return found;
}

describe('recipe overrides', () => {
  it('catches a plain hover colour or size stacked on a recipe', () => {
    expect(stackedOverrides('`${btnIcon} hover:text-brand-text`')).toEqual(['btnIcon + hover:text-brand-text']);
    expect(stackedOverrides('`${btnGhost} flex-1 dark:hover:bg-hover-dark`')).toHaveLength(1);
    expect(stackedOverrides('`${btnPrimary} h-9 min-h-0`')).toEqual(['btnPrimary + h-9', 'btnPrimary + min-h-0']);
    expect(stackedOverrides('`${btnIcon} w-7 h-7`')).toHaveLength(2);
    expect(stackedOverrides('`${btnGhost} ${on ? `px-2` : ``}`')).toEqual(['btnGhost + px-2']);
    expect(stackedOverrides("`${btnIcon} ${on ? 'w-7' : \"h-7\"}`")).toEqual(['btnIcon + w-7', 'btnIcon + h-7']);
    expect(stackedOverrides('`${btnPrimarySm} h-8`')).toEqual(['btnPrimarySm + h-8']);
    expect(stackedOverrides('`${badgeBtn} w-11`')).toEqual(['badgeBtn + w-11']);
  });

  it('lets through what does not compete', () => {
    expect(stackedOverrides('`${btnIcon} hover:!text-brand-text lg:!w-7`')).toEqual([]);
    expect(stackedOverrides('`${btnPrimary} w-full mt-1 flex-1`')).toEqual([]);
    expect(stackedOverrides('`${btnIcon} absolute top-1`')).toEqual([]);
    expect(stackedOverrides('`${btnGhost}` + `h-9`')).toEqual([]);
  });

  it.each(components)('%s overrides recipes only with !', (_path, source) => {
    expect(stackedOverrides(source)).toEqual([]);
  });
});
