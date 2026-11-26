import { PHONE_COUNTRIES, formatNational, parseStoredPhone, phoneValue, typedDigits } from './phone';

const us = PHONE_COUNTRIES.find((c) => c.id === 'US')!;
const np = PHONE_COUNTRIES.find((c) => c.id === 'NP')!;

describe('formatNational', () => {
  it.each([
    ['', ''],
    ['5', '(5'],
    ['555', '(555'],
    ['5551', '(555) 1'],
    ['555123', '(555) 123'],
    ['5551234', '(555) 123-4'],
    ['5551234567', '(555) 123-4567'],
  ])('US %s → %s', (digits, out) => {
    expect(formatNational(us, digits)).toBe(out);
  });

  it('formats a Nepali mobile', () => {
    expect(formatNational(np, '9841234567')).toBe('984-1234567');
  });
});

describe('typedDigits', () => {
  it('keeps digits only, up to the country length', () => {
    expect(typedDigits(us, '(555) 123-4567 ext 9')).toBe('5551234567');
  });

  it('drops a leading country code typed into the field', () => {
    expect(typedDigits(us, '+1 555 123 4567')).toBe('5551234567');
    expect(typedDigits(us, '1 555 123 4567')).toBe('5551234567');
    expect(typedDigits(np, '+977 984 123 4567')).toBe('9841234567');
  });
});

describe('phoneValue', () => {
  it('stores the code and the formatted number', () => {
    expect(phoneValue(us, '5551234567')).toBe('+1 (555) 123-4567');
    expect(phoneValue(np, '9841234567')).toBe('+977 984-1234567');
  });

  it('stores nothing for no digits', () => {
    expect(phoneValue(us, '')).toBe('');
  });
});

describe('parseStoredPhone', () => {
  it('reads a stored value back', () => {
    expect(parseStoredPhone('+1 (555) 123-4567', us)).toEqual({ country: us, digits: '5551234567' });
    expect(parseStoredPhone('+977 984-1234567', us)).toEqual({ country: np, digits: '9841234567' });
  });

  it('reads an old bare Nepali mobile as Nepal, as the WhatsApp link always has', () => {
    expect(parseStoredPhone('9841234567', us)).toEqual({ country: np, digits: '9841234567' });
  });

  it('reads any other bare number in the fallback country', () => {
    expect(parseStoredPhone('5551234567', us)).toEqual({ country: us, digits: '5551234567' });
    expect(parseStoredPhone('', np)).toEqual({ country: np, digits: '' });
  });
});
