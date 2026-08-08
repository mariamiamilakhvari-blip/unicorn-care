import { describe, expect, it } from 'vitest';

import { suggestEmailCorrection } from '@/shared/utils/email-domain';

describe('suggestEmailCorrection', () => {
  it.each([
    ['nino@gmial.com', 'nino@gmail.com'],
    ['nino@gmail.co', 'nino@gmail.com'],
    ['nino@yaho.com', 'nino@yahoo.com'],
    ['nino@hotmial.com', 'nino@hotmail.com'],
    ['nino@outlok.com', 'nino@outlook.com'],
  ])('suggests a correction for %s', (typed, expected) => {
    expect(suggestEmailCorrection(typed)).toBe(expected);
  });

  it('preserves the local part exactly, including dots and plus tags', () => {
    expect(suggestEmailCorrection('nino.b+clinic@gmial.com')).toBe('nino.b+clinic@gmail.com');
  });

  it('matches the domain case-insensitively', () => {
    expect(suggestEmailCorrection('nino@GMIAL.COM')).toBe('nino@gmail.com');
  });

  it.each([
    ['a correct address', 'nino@gmail.com'],
    ['a clinic’s own domain', 'nino@gaguaclinic.ge'],
    ['a small national provider', 'nino@mail.ru'],
    ['an address with no @', 'not-an-email'],
    ['an empty string', ''],
    ['a leading @', '@gmail.com'],
  ])('says nothing about %s', (_label, value) => {
    /*
      Silence is the right answer for anything not on the list. A generic "did you mean" is
      confidently wrong on the long tail, and a wrong suggestion in a medical record is worse than
      none — a clinic in a hurry accepts it, and the patient's reminders go to a stranger.
    */
    expect(suggestEmailCorrection(value)).toBeNull();
  });
});
