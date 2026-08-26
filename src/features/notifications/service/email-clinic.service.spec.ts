import { describe, expect, it } from 'vitest';

import { toEmailClinic } from '@/features/notifications/service/email-clinic.service';

/** A clinic that has filled in both English fields — the case this whole mechanism exists for. */
const bilingual = {
  name: 'გაგუას კლინიკა',
  nameEn: 'Gagua Clinic',
  addressLine: 'საბურთალო: ვაჟა-ფშაველას გამზ. N40',
  addressLineEn: 'Saburtalo: 40 Vazha-Pshavela Ave',
  phone: '99532 2 122 122',
  email: 'info@gaguaclinic.ge',
};

/** The normal case: a Georgian practice that has never opened the English boxes. */
const georgianOnly = {
  name: 'გაგუას კლინიკა',
  addressLine: 'საბურთალო: ვაჟა-ფშაველას გამზ. N40',
  phone: '99532 2 122 122',
  email: 'info@gaguaclinic.ge',
};

const TZ = 'Asia/Tbilisi';

describe('toEmailClinic', () => {
  it('writes the English name and address into an English email', () => {
    const clinic = toEmailClinic(bilingual, 'en', TZ);
    expect(clinic.name).toBe('Gagua Clinic');
    expect(clinic.addressLine).toBe('Saburtalo: 40 Vazha-Pshavela Ave');
  });

  it('keeps the Georgian name and address in a Georgian email, even when English exists', () => {
    const clinic = toEmailClinic(bilingual, 'ka', TZ);
    expect(clinic.name).toBe('გაგუას კლინიკა');
    expect(clinic.addressLine).toBe('საბურთალო: ვაჟა-ფშაველას გამზ. N40');
  });

  /*
    The reason the fallback is to the original rather than to nothing. A patient who cannot read
    Mkhedruli still learns which clinic wrote to them from a Georgian name; a blank footer, or one
    reading "Address:" with nothing after it, tells them only that something is broken.
  */
  it('falls back to the Georgian text when the clinic supplied no English', () => {
    const clinic = toEmailClinic(georgianOnly, 'en', TZ);
    expect(clinic.name).toBe('გაგუას კლინიკა');
    expect(clinic.addressLine).toBe('საბურთალო: ვაჟა-ფშაველას გამზ. N40');
  });

  // A field somebody opened, spaced and abandoned holds a truthy string that prints as a blank.
  it('treats a whitespace-only English field as unfilled', () => {
    const clinic = toEmailClinic({ ...georgianOnly, nameEn: '   ', addressLineEn: '\t' }, 'en', TZ);
    expect(clinic.name).toBe('გაგუას კლინიკა');
    expect(clinic.addressLine).toBe('საბურთალო: ვაჟა-ფშაველას გამზ. N40');
  });

  it('leaves the phone and the contact email alone in both languages', () => {
    for (const locale of ['ka', 'en'] as const) {
      const clinic = toEmailClinic(bilingual, locale, TZ);
      expect(clinic.phone).toBe('99532 2 122 122');
      expect(clinic.email).toBe('info@gaguaclinic.ge');
    }
  });

  /*
    The zone is the caller's to decide and must never be read off the clinic: a reminder prints its
    times where the patient is, and printing them in the clinic's zone is what told a patient
    recovering abroad to take a 09:30 tablet at 07:30.
  */
  it('carries the timezone it was given rather than any zone of the clinic', () => {
    expect(toEmailClinic(bilingual, 'en', 'Europe/Berlin').timezone).toBe('Europe/Berlin');
  });

  // A portal link is still worth sending when the clinic row behind it has gone.
  it('yields empty strings rather than throwing when there is no clinic', () => {
    expect(toEmailClinic(null, 'en', TZ)).toEqual({
      name: '',
      addressLine: '',
      phone: '',
      email: '',
      timezone: TZ,
    });
  });

  // Every optional field arrives nullable off a Mongoose document, not merely absent.
  it('normalises nulls off a document into empty strings', () => {
    const clinic = toEmailClinic(
      { name: 'Solo', nameEn: null, addressLine: null, addressLineEn: null, phone: null, email: null },
      'en',
      TZ
    );
    expect(clinic).toEqual({
      name: 'Solo',
      addressLine: '',
      phone: '',
      email: '',
      timezone: TZ,
    });
  });
});
