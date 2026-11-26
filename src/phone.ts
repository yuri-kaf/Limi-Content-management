// Phone numbers for leads: one field for phone and WhatsApp, US format by
// default (most new leads are US businesses), with the country switchable.
// Stored as "+<code> <formatted number>", which reads well on the lead and
// gives the tel: and wa.me links the country code they need.

export interface PhoneCountry {
  id: string;
  label: string;
  code: string;
  /** '#' for each digit of the national number. */
  pattern: string;
  /** Placeholder digits, so the empty field shows the format. */
  example: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { id: 'US', label: 'US', code: '1', pattern: '(###) ###-####', example: '2125550123' },
  { id: 'CA', label: 'Canada', code: '1', pattern: '(###) ###-####', example: '4165550123' },
  { id: 'NP', label: 'Nepal', code: '977', pattern: '###-#######', example: '9841234567' },
  { id: 'GB', label: 'UK', code: '44', pattern: '#### ######', example: '7400123456' },
  { id: 'AU', label: 'Australia', code: '61', pattern: '### ### ###', example: '412345678' },
  { id: 'IN', label: 'India', code: '91', pattern: '##### #####', example: '9812345678' },
  { id: 'AE', label: 'UAE', code: '971', pattern: '## ### ####', example: '501234567' },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export function phoneCountry(id: string | undefined): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.id === id) ?? DEFAULT_PHONE_COUNTRY;
}

const maxDigits = (c: PhoneCountry) => c.pattern.split('#').length - 1;

/** The national number as it is typed: "(555) 123-4", filled from the left. */
export function formatNational(country: PhoneCountry, digits: string): string {
  let out = '';
  let i = 0;
  for (const ch of country.pattern) {
    if (i >= digits.length) break;
    if (ch === '#') out += digits[i++];
    else out += ch;
  }
  return out + digits.slice(i);
}

/**
 * The national digits in what was typed or pasted, without the country code
 * when it was included ("+1 555…", or "1555…" one digit too long).
 */
export function typedDigits(country: PhoneCountry, raw: string): string {
  let digits = raw.replace(/\D/g, '');
  const max = maxDigits(country);
  const coded = raw.trim().startsWith('+') || digits.length > max;
  if (coded && digits.startsWith(country.code) && digits.length > country.code.length) {
    digits = digits.slice(country.code.length);
  }
  return digits.slice(0, max);
}

export function phoneValue(country: PhoneCountry, digits: string): string {
  return digits ? `+${country.code} ${formatNational(country, digits)}` : '';
}

/**
 * A stored number back into its country and digits. Numbers saved before the
 * country picker had no code: a ten-digit one starting with 9 is a Nepali
 * mobile (the WhatsApp link has always read it so), anything else is taken in
 * the fallback country.
 */
export function parseStoredPhone(
  stored: string | undefined,
  fallback: PhoneCountry
): { country: PhoneCountry; digits: string } {
  const value = (stored ?? '').trim();
  const digits = value.replace(/\D/g, '');
  if (!digits) return { country: fallback, digits: '' };
  if (value.startsWith('+')) {
    const country = [...PHONE_COUNTRIES]
      .sort((a, b) => b.code.length - a.code.length)
      .find((c) => digits.startsWith(c.code));
    if (country) {
      // Countries sharing a code (US and Canada) read as the first listed.
      const first = PHONE_COUNTRIES.find((c) => c.code === country.code)!;
      return { country: first, digits: digits.slice(first.code.length) };
    }
    return { country: fallback, digits };
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return { country: phoneCountry('NP'), digits };
  }
  return { country: fallback, digits };
}
