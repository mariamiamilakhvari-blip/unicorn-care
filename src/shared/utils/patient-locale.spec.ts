import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  resolveClinicLocale,
  resolvePatientLocale,
} from '@/shared/utils/patient-locale';

const KA = { locale: 'ka' };
const EN = { locale: 'en' };

describe('resolvePatientLocale', () => {
  /**
   * The person reading the email is the one whose preference decides. A clinic operating in
   * Georgian may still treat somebody who asked for English.
   */
  it('prefers the patient over the clinic', () => {
    expect(resolvePatientLocale(EN, KA)).toBe('en');
    expect(resolvePatientLocale(KA, EN)).toBe('ka');
  });

  it.each([
    ['no record at all', null],
    ['an undefined record', undefined],
    ['a record with no locale', {}],
    ['a record with a null locale', { locale: null }],
  ])('falls back to the clinic given %s', (_case, patient) => {
    expect(resolvePatientLocale(patient, EN)).toBe('en');
  });

  /*
    The value comes out of Mongo, and the six call sites this replaced asserted its shape with a
    cast rather than checking it. The email copy survived a bad value by accident — anything that
    is not 'en' renders Georgian — but the recovery-guide lookup does not: `findForClinic(id, type,
    'ka-GE')` matches no row, so the patient loses the guidance rather than reading it in the wrong
    language.
  */
  describe('a value the product does not speak', () => {
    it.each(['EN', 'ka-GE', 'ru', '', 'en-US', 'KA'])('does not let %s through', value => {
      expect(resolvePatientLocale({ locale: value }, KA)).toBe('ka');
    });

    it('falls past a bad patient value to a good clinic one', () => {
      expect(resolvePatientLocale({ locale: 'ru' }, EN)).toBe('en');
    });

    it('lands on the default when neither side is usable', () => {
      expect(resolvePatientLocale({ locale: 'ru' }, { locale: 'de' })).toBe(DEFAULT_LOCALE);
      expect(resolvePatientLocale(null, null)).toBe(DEFAULT_LOCALE);
    });
  });

  /** Georgian is the default: this is a Georgian clinic product, and English is the exception. */
  it('defaults to Georgian', () => {
    expect(DEFAULT_LOCALE).toBe('ka');
  });
});

describe('resolveClinicLocale', () => {
  /** Staff-facing mail — the symptom alert and the analytics report — follows the clinic alone. */
  it('reads the clinic and nothing else', () => {
    expect(resolveClinicLocale(EN)).toBe('en');
    expect(resolveClinicLocale(KA)).toBe('ka');
  });

  it.each([
    ['a missing clinic', null],
    ['a clinic with no locale', {}],
    ['a clinic with an unknown locale', { locale: 'ru' }],
  ])('defaults given %s', (_case, clinic) => {
    expect(resolveClinicLocale(clinic)).toBe(DEFAULT_LOCALE);
  });
});
