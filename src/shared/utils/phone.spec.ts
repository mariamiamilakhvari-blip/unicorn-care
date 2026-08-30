import { describe, expect, it } from 'vitest';

import { toDialNumber, toWhatsAppNumber, whatsAppLink } from '@/shared/utils/phone';

describe('toWhatsAppNumber', () => {
  it.each([
    ['a plain international number', '+995322122122', '995322122122'],
    ['the spacing a clinic actually types', '995 32 2 122 122', '995322122122'],
    ['dashes and brackets', '+44 (0)20-7946-0958', '4402079460958'],
    ['the 00 prefix, which WhatsApp does not understand', '00995322122122', '995322122122'],
  ])('strips %s', (_label, input, expected) => {
    expect(toWhatsAppNumber(input)).toBe(expected);
  });

  /*
    An empty answer is the useful one here. The caller renders plain text instead of a link, so a
    number WhatsApp could not open never becomes a button that fails in the clinician's face.
  */
  it.each([
    ['nothing at all', ''],
    ['an extension rather than a number', '122'],
    ['digits short of any real country', '1234567'],
    ['more digits than E.164 allows', '1234567890123456'],
    ['text a clinic typed into the box', 'call the mobile'],
  ])('refuses %s', (_label, input) => {
    expect(toWhatsAppNumber(input)).toBe('');
  });
});

describe('whatsAppLink', () => {
  it('builds the chat URL from the normalised digits', () => {
    expect(whatsAppLink('+995 322 122 122')).toBe('https://wa.me/995322122122');
  });

  it('returns nothing to link to when the number is unusable', () => {
    expect(whatsAppLink('122')).toBe('');
  });
});

describe('toDialNumber', () => {
  it('keeps the leading plus, because dropping it dials the wrong country', () => {
    expect(toDialNumber('+995 322 122 122')).toBe('+995322122122');
  });

  it('strips the spacing that breaks some diallers', () => {
    expect(toDialNumber('995 32 2 122 122')).toBe('995322122122');
  });
});
