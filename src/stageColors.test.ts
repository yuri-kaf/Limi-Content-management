import { stageCardFill, stageCardText, stageCardVars, stageDot } from './stageColors';
import { STAGES } from './utils';

describe('stageCardVars', () => {
  it('carries both theme pairs for a stage', () => {
    const vars = stageCardVars('review') as Record<string, string>;
    expect(vars['--sc-tint']).toBe('#dcedf9');
    expect(vars['--sc-text']).toBe('#0a5f86');
    expect(vars['--sc-tint-dark']).toBe('#16344a');
    expect(vars['--sc-text-dark']).toBe('#8cc8e6');
  });

  it('falls back to the first stage for an unknown status', () => {
    expect(stageCardVars('archived')).toEqual(stageCardVars(STAGES[0].id));
  });

  it('sets every custom property the classes read', () => {
    // Renaming one side without the other would silently un-colour every card.
    const read = [stageCardFill, stageCardText, stageDot].flatMap((cls) =>
      [...cls.matchAll(/var\((--sc-[a-z-]+)\)/g)].map((m) => m[1])
    );
    const set = Object.keys(stageCardVars('posted'));
    expect(read.length).toBeGreaterThan(0);
    for (const name of read) expect(set).toContain(name);
  });
});
