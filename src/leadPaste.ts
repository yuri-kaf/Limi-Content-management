import { LeadDraft, LeadSource } from './types';
import { handleOf, nameFromHandle, parseProfileInput, type SocialField } from './leads';

/**
 * What a paste says about a lead. Sales copies whatever the business shows
 * (a profile link, a bio, a "name - number" line from a chat) and this sorts
 * it into the form's fields, so nobody retypes it field by field.
 */
export type LeadPaste = Partial<Pick<LeadDraft,
  'name' | 'source' | 'instagram' | 'tiktok' | 'facebook' | 'website' | 'phone' | 'email' | 'location'>>;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// A link or a bare domain. Bare domains need a real-looking ending, so a
// handle such as "cafe.ktm" is not taken for a website.
const URL_RE = /(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s,]*)?/gi;
const SITE_TLD = /\.(?:com|np|net|org|co|io|info|biz|store|shop|app|me|ee|ai|link|site|online|xyz|edu|gov|in|us|uk|au)$/i;
// Link-in-bio pages: kept only when there is no site of the business's own.
const LINK_HUB = /(?:^|\.)(?:linktr\.ee|bio\.link|beacons\.ai|linkin\.bio|taplink\.cc|wa\.me|maps\.app\.goo\.gl|goo\.gl)$/i;
const HANDLE = /(^|[\s,(])@([\w.]{2,30})(?=$|[\s,)])/g;
// Phone numbers, most specific first. A number pasted with its country code
// keeps it ("+977 9841234567", "+1 5551234567"); a bare one is digits only
// and takes the country picked in the form. Years and prices are too short
// to match any of these.
const NP_CODED = /(?<!\d)\+?977[\s-]?(9[678](?:[\s-]?\d){8})(?!\d)/;
const NANP = /(?<![\d+])(\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/;
const NP_MOBILE = /(?<!\d)9[678](?:[\s-]?\d){8}(?!\d)/;
const INTL = /\+\d[\d\s().-]{7,16}\d/;
const LANDLINE = /(?<!\d)0\d{1,2}[\s-]?\d{6,7}(?!\d)/;

const digitsOf = (s: string) => s.replace(/\D/g, '');

/** The first phone number in the text, and the exact text it was read from. */
function findPhone(text: string): { phone: string; match: string } | null {
  let m = text.match(NP_CODED);
  if (m) return { phone: `+977 ${digitsOf(m[1])}`, match: m[0] };
  m = text.match(NANP);
  if (m) return { phone: `${m[1] ? '+1 ' : ''}${m[2]}${m[3]}${m[4]}`, match: m[0] };
  m = text.match(NP_MOBILE);
  if (m) return { phone: digitsOf(m[0]), match: m[0] };
  m = text.match(INTL);
  if (m) return { phone: `+${digitsOf(m[0])}`, match: m[0] };
  m = text.match(LANDLINE);
  if (m) return { phone: m[0].trim(), match: m[0] };
  return null;
}
const LOCATION_LINE = /^\s*(?:📍|📌|🏠|(?:location|address|addr)\s*[:-])\s*/iu;
const PICTO = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;

function hostOf(token: string): string {
  return token.replace(/^https?:\/\//i, '').split(/[/?#]/)[0].toLowerCase();
}

function isSiteToken(token: string): boolean {
  return /^https?:\/\//i.test(token) || token.includes('/') || SITE_TLD.test(hostOf(token));
}

function tidyName(line: string): string {
  return line
    .replace(PICTO, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|•:·,]+|[\s\-–—|•:·,]+$/g, '')
    .trim()
    .slice(0, 80);
}

export function parseLeadText(text: string): LeadPaste {
  const raw = text.replace(/\r/g, '').trim();
  if (!raw) return {};

  const out: LeadPaste = {};
  const socials: { field: SocialField; handle: string; at: number }[] = [];
  const sites: string[] = [];
  let rest = raw;
  const blank = (s: string) => ' '.repeat(s.length);

  // A single bare word such as "cafe.ktm" is an Instagram handle, the way the
  // form has always read it.
  if (!/\s/.test(raw) && !isSiteToken(raw)) {
    const profile = parseProfileInput(raw);
    if (profile) return { name: nameFromHandle(profile.handle), [profile.field]: profile.handle, source: profile.field };
  }

  rest = rest.replace(EMAIL, (m) => {
    out.email ??= m;
    return blank(m);
  });

  rest = rest.replace(URL_RE, (m, at: number) => {
    const token = m.replace(/[.,;:)]+$/, '');
    if (!isSiteToken(token)) return m;
    const profile = parseProfileInput(token.includes('/') ? token : `${token}/`);
    if (profile && /(instagram|tiktok|facebook|fb)\./i.test(token)) {
      socials.push({ ...profile, at });
    } else if (!/(instagram|tiktok|facebook|fb)\./i.test(token)) {
      sites.push(token);
    }
    return blank(m);
  });

  rest = rest.replace(HANDLE, (m, lead: string, handle: string, at: number) => {
    socials.push({ field: 'instagram', handle: handleOf(handle), at });
    return lead + blank(m.slice(lead.length));
  });

  const phone = findPhone(rest);
  if (phone) {
    out.phone = phone.phone;
    rest = rest.replace(phone.match, blank(phone.match));
  }

  socials.sort((a, b) => a.at - b.at);
  for (const s of socials) out[s.field] ??= s.handle;
  if (socials.length) out.source = socials[0].field as LeadSource;

  const site = sites.find((s) => !LINK_HUB.test(hostOf(s))) ?? sites[0];
  if (site) out.website = site;

  const lines = rest.split('\n');
  let nameLine = -1;
  lines.forEach((line, i) => {
    if (out.location === undefined && LOCATION_LINE.test(line)) {
      const loc = tidyName(line.replace(LOCATION_LINE, ''));
      if (loc) out.location = loc;
      lines[i] = '';
    }
  });
  for (let i = 0; i < lines.length; i++) {
    if (/\p{L}/u.test(tidyName(lines[i]))) {
      nameLine = i;
      break;
    }
  }
  // The name is the first line with words left once the contacts are taken
  // out, and only when it is the paste's first line: a bio's later lines are
  // its description, not the business.
  const firstFilled = raw.split('\n').findIndex((l) => l.trim());
  if (nameLine !== -1 && nameLine === firstFilled) out.name = tidyName(lines[nameLine]);
  else if (socials.length) out.name = nameFromHandle(socials[0].handle);

  return Object.fromEntries(Object.entries({
    name: out.name, instagram: out.instagram, tiktok: out.tiktok, facebook: out.facebook,
    source: out.source, phone: out.phone, email: out.email, website: out.website, location: out.location,
  }).filter(([, v]) => v !== undefined && v !== '')) as LeadPaste;
}
