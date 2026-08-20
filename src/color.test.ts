import { contrastRatio, relativeLuminance } from './color';

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
