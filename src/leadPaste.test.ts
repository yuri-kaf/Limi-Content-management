import { parseLeadText } from './leadPaste';

describe('parseLeadText', () => {
  it('reads an Instagram link alone', () => {
    expect(parseLeadText('https://www.instagram.com/cafe.ktm/?igsh=abc')).toEqual({
      name: 'Cafe Ktm', instagram: 'cafe.ktm', source: 'instagram',
    });
  });

  it('reads a TikTok link alone', () => {
    expect(parseLeadText('https://www.tiktok.com/@momo.house?lang=en')).toEqual({
      name: 'Momo House', tiktok: 'momo.house', source: 'tiktok',
    });
  });

  it('reads a bare @handle as Instagram', () => {
    expect(parseLeadText('@bakery_jhamsikhel')).toMatchObject({
      instagram: 'bakery_jhamsikhel', name: 'Bakery Jhamsikhel',
    });
  });

  it('takes a plain name as the name', () => {
    expect(parseLeadText('Himalayan Java')).toEqual({ name: 'Himalayan Java' });
  });

  it('reads a whole copied bio', () => {
    const bio = [
      'Cafe Mitra ☕',
      'Best coffee in town',
      '📍 Jhamsikhel, Lalitpur',
      '📞 +977 984-1234567',
      'hello@cafemitra.com',
      'www.cafemitra.com.np',
      'instagram.com/cafe.mitra',
    ].join('\n');
    expect(parseLeadText(bio)).toEqual({
      name: 'Cafe Mitra',
      instagram: 'cafe.mitra',
      source: 'instagram',
      phone: '+977 9841234567',
      email: 'hello@cafemitra.com',
      website: 'www.cafemitra.com.np',
      location: 'Jhamsikhel, Lalitpur',
    });
  });

  it('reads a US business card line', () => {
    expect(parseLeadText('Glow Med Spa | (214) 555-0199 | glowmedspa.com')).toEqual({
      name: 'Glow Med Spa', phone: '2145550199', website: 'glowmedspa.com',
    });
  });

  it('reads "name - phone" on one line', () => {
    expect(parseLeadText('Kathmandu Kitchen - 9801234567')).toEqual({
      name: 'Kathmandu Kitchen', phone: '9801234567',
    });
  });

  it('reads a landline', () => {
    expect(parseLeadText('Nepal Furniture 01-5523344')).toMatchObject({
      name: 'Nepal Furniture', phone: '01-5523344',
    });
  });

  it('does not take a year or a price for a phone', () => {
    expect(parseLeadText('Est. 2019, menu from Rs 450').phone).toBeUndefined();
  });

  it('keeps every platform found', () => {
    expect(parseLeadText('instagram.com/abc.store tiktok.com/@abcstore facebook.com/abcstorenp')).toMatchObject({
      instagram: 'abc.store', tiktok: 'abcstore', facebook: 'abcstorenp', source: 'instagram',
    });
  });

  it('names from a handle when the only line is the link', () => {
    expect(parseLeadText('  instagram.com/the_dough_lab  ').name).toBe('The Dough Lab');
  });

  it('does not take linktree for the website when a real site is there', () => {
    expect(parseLeadText('linktr.ee/abc\nabc.com.np').website).toBe('abc.com.np');
  });

  it.each([
    ['98412 34567', '9841234567'],
    ['+9779812345678', '+977 9812345678'],
    ['977-984-123-4567', '+977 9841234567'],
    ['(555) 123-4567', '5551234567'],
    ['555.123.4567', '5551234567'],
    ['+1 555-123-4567', '+1 5551234567'],
    ['1-555-123-4567', '+1 5551234567'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('reads the number %s', (raw, phone) => {
    expect(parseLeadText(`Shop ${raw}`).phone).toBe(phone);
  });

  it('reads name, link and number on one line', () => {
    expect(parseLeadText('Cafe Ktm instagram.com/cafe.ktm 9841234567')).toEqual({
      name: 'Cafe Ktm', instagram: 'cafe.ktm', source: 'instagram', phone: '9841234567',
    });
  });

  it('takes the location after "Address:"', () => {
    expect(parseLeadText('Glow Salon\nAddress: Baneshwor, Kathmandu').location).toBe('Baneshwor, Kathmandu');
  });

  it('returns nothing for empty text', () => {
    expect(parseLeadText('  \n ')).toEqual({});
  });
});
