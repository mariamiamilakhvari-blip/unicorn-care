import { describe, expect, it } from 'vitest';

import {
  ClinicOnlySchema,
  ClinicSignUpSchema,
} from '@/features/clinic/validations/clinic-signup.validation';
import {
  ClinicProfileSchema,
  CreateClinicForUserSchema,
  RegisterClinicSchema,
  UpdateClinicSchema,
} from '@/features/clinic/validations/clinic.validation';

const base = {
  name: 'Unicorn Clinic',
  country: 'Georgia',
  city: 'Tbilisi',
  addressLine: '12 Rustaveli',
  phone: '+995555000111',
  locale: 'ka' as const,
  timezone: 'Asia/Tbilisi',
};

/** Every mandatory box ticked except the DPA, so each case below states its own answer. */
const consents = {
  terms: true,
  privacy: true,
  patientConsents: true,
  accuracy: true,
  credentials: true,
  processingPurpose: true,
  remindersNotMedicalAdvice: true,
  regulatoryCompliance: true,
};

const parseTaxId = (taxId: string, country = 'Georgia') =>
  ClinicProfileSchema.safeParse({ ...base, country, taxId });

const taxIdError = (result: ReturnType<typeof parseTaxId>) =>
  result.success ? null : result.error.issues[0];

/**
 * The point of this field is that it is not a Georgian field, but it *is* Georgian first: the
 * product sells into Georgia, where the same box holds a 9-digit company code or an 11-digit
 * personal number, and everywhere else it holds a VAT number. Each case here is a real format, so
 * a rule change that quietly excludes one fails here rather than at a clinic's first invoice.
 */
describe('ClinicProfileSchema.taxId', () => {
  it.each([
    ['Georgian company code', '204567891', 'Georgia'],
    ['Georgian personal number', '01001012345', 'Georgia'],
    ['German VAT', 'DE123456789', 'Germany'],
    ['US EIN', '12-3456789', 'United States'],
    ['UK company number', 'SC123456', 'United Kingdom'],
    ['French VAT with spacing', 'FR 12 345678901', 'France'],
    ['Polish NIP with hyphens', '123-456-32-18', 'Poland'],
    ['lowercase prefix', 'de123456789', 'Germany'],
  ])('accepts a %s', (_label, value, country) => {
    expect(parseTaxId(value, country).success).toBe(true);
  });

  it('accepts an empty value, because it is collected for billing and not for sign-up', () => {
    expect(parseTaxId('').success).toBe(true);
  });

  it('defaults to an empty string when the field is absent entirely', () => {
    const result = ClinicProfileSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.success && result.data.taxId).toBe('');
  });

  it.each([
    ['surrounding whitespace on a pasted value', '  DE123456789  ', 'DE123456789', 'Germany'],
    ['grouping spaces', 'FR 12 345678901', 'FR12345678901', 'France'],
    ['hyphens', '12-3456789', '123456789', 'United States'],
  ])('strips %s before storing', (_label, input, stored, country) => {
    const result = parseTaxId(input, country);
    expect(result.success && result.data.taxId).toBe(stored);
  });

  it.each([
    ['a comma', 'DE123,456789'],
    ['a slash', '12/3456789'],
    ['a trailing plus', 'DE123456789+'],
  ])('rejects %s with the character code', (_label, value) => {
    expect(taxIdError(parseTaxId(value, 'Germany'))?.message).toBe('INVALID_TAX_ID');
  });

  it.each([
    ['8 digits', '20456789'],
    ['10 digits', '2045678912'],
    ['a letter prefix', 'GE204567891'],
  ])('rejects %s for a Georgian clinic', (_label, value) => {
    expect(taxIdError(parseTaxId(value))?.message).toBe('INVALID_TAX_ID_GE');
  });

  it('rejects a VAT number that does not match the selected country', () => {
    expect(taxIdError(parseTaxId('DE12345', 'Germany'))?.message).toBe('INVALID_TAX_ID_VAT');
  });

  it.each([
    ['too short', 'AB12'],
    ['too long', 'A234567890123456'],
  ])('rejects a %s value in a country with no codified format', (_label, value) => {
    expect(taxIdError(parseTaxId(value, 'Brazil'))?.message).toBe('INVALID_TAX_ID_LENGTH');
  });

  it('reports the failure under the field, so the form shows it beneath the input', () => {
    expect(taxIdError(parseTaxId('123'))?.path).toEqual(['taxId']);
  });

  it('rejects a value longer than the column allows', () => {
    expect(parseTaxId('A'.repeat(81)).success).toBe(false);
  });
});

/**
 * The rule has to hold on all three paths into the field. The registration form flattens the
 * clinic fields alongside the owner's, and the settings PATCH sends a partial body — both
 * reshape the profile schema, and Zod does not carry a refinement through every reshape.
 */
describe('the tax ID rule across every schema that carries the field', () => {
  const signUp = {
    email: 'owner@clinic.ge',
    password: 'supersecret',
    clinicName: 'Unicorn Clinic',
    country: 'Georgia',
    city: 'Tbilisi',
    addressLine: '12 Rustaveli',
    clinicPhone: '+995555000111',
    locale: 'ka' as const,
    timezone: 'Asia/Tbilisi',
    // These cases are about the tax ID, so the consent half has to be valid throughout — the DPA
    // is mandatory now, and leaving it off would fail every one of them for the wrong reason.
    consents: { ...consents, dataProcessing: true },
  };

  it('blocks registration with a Georgian tax ID of the wrong length', () => {
    const result = ClinicSignUpSchema.safeParse({ ...signUp, taxId: '2045678' });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe('INVALID_TAX_ID_GE');
  });

  it('registers a valid one and stores it sanitised', () => {
    const result = ClinicSignUpSchema.safeParse({ ...signUp, taxId: ' 204-567-891 ' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.taxId).toBe('204567891');
  });

  it('blocks a settings PATCH that would save an invalid number', () => {
    const result = UpdateClinicSchema.safeParse({ country: 'Georgia', taxId: '20456789' });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe('INVALID_TAX_ID_GE');
  });

  it('lets a PATCH that does not touch the tax ID through untouched', () => {
    expect(UpdateClinicSchema.safeParse({ city: 'Batumi' }).success).toBe(true);
  });

  it('raises the error once, not once per schema in the chain', () => {
    const result = ClinicSignUpSchema.safeParse({ ...signUp, taxId: '20456789' });
    expect(!result.success && result.error.issues).toHaveLength(1);
  });
});

/**
 * The Data Processing Agreement.
 *
 * It replaced a Business Associate Agreement that was mandatory for US clinics and merely offered
 * to everyone else, so the cases that used to matter were about the clinic's country. They no
 * longer are: the Law of Georgia on Personal Data Protection requires a written processor
 * agreement from every controller that engages one, which makes this simply mandatory — and the
 * thing worth pinning is that no body can create a clinic without it, whatever country it is in.
 */
describe('the Data Processing Agreement', () => {
  const georgianProfile = { ...base, country: 'Georgia', taxId: '204567891' };

  const signUpIn = (country: string, dataProcessing: boolean) => ({
    email: 'owner@clinic.com',
    password: 'supersecret',
    clinicName: 'Unicorn Clinic',
    country,
    city: 'Tbilisi',
    addressLine: '12 Rustaveli Ave',
    clinicPhone: '+995322000111',
    taxId: '204567891',
    locale: 'ka' as const,
    timezone: 'Asia/Tbilisi',
    consents: { ...consents, dataProcessing },
  });

  const dpaError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.success ? null : result.error?.issues[0].message;

  describe('at registration', () => {
    it('blocks a Georgian clinic that has not accepted it', () => {
      const result = ClinicSignUpSchema.safeParse(signUpIn('Georgia', false));
      expect(result.success).toBe(false);
      expect(dpaError(result)).toBe('CONSENT_REQUIRED');
    });

    it('admits a Georgian clinic that has', () => {
      expect(ClinicSignUpSchema.safeParse(signUpIn('Georgia', true)).success).toBe(true);
    });

    it('blocks a clinic outside Georgia too — the agreement is not country-conditional', () => {
      const result = ClinicSignUpSchema.safeParse({
        ...signUpIn('Netherlands', false),
        taxId: '123456789',
      });
      expect(result.success).toBe(false);
      expect(dpaError(result)).toBe('CONSENT_REQUIRED');
    });

    it('reports the failure under the checkbox, not at the top of the form', () => {
      const result = ClinicSignUpSchema.safeParse(signUpIn('Georgia', false));
      expect(!result.success && result.error.issues[0].path).toEqual([
        'consents',
        'dataProcessing',
      ]);
    });
  });

  describe('on the API bodies', () => {
    it('blocks the register endpoint without it', () => {
      const result = RegisterClinicSchema.safeParse({
        owner: { name: 'Pat Owner', email: 'owner@clinic.com', password: 'supersecret' },
        clinic: georgianProfile,
        consents: { ...consents, dataProcessing: false },
      });
      expect(result.success).toBe(false);
      expect(dpaError(result)).toBe('CONSENT_REQUIRED');
    });

    it('admits the register endpoint once it is accepted', () => {
      const result = RegisterClinicSchema.safeParse({
        owner: { name: 'Pat Owner', email: 'owner@clinic.com', password: 'supersecret' },
        clinic: georgianProfile,
        consents: { ...consents, dataProcessing: true },
      });
      expect(result.success).toBe(true);
    });

    it('blocks the repair path without it', () => {
      const result = CreateClinicForUserSchema.safeParse({
        ...georgianProfile,
        consents: { ...consents, dataProcessing: false },
      });
      expect(dpaError(result)).toBe('CONSENT_REQUIRED');
    });

    it('blocks the onboarding form without it', () => {
      const result = ClinicOnlySchema.safeParse({
        ...georgianProfile,
        consents: { ...consents, dataProcessing: false },
      });
      expect(dpaError(result)).toBe('CONSENT_REQUIRED');
    });

    it('treats an omitted checkbox as invalid, not as a recorded false', () => {
      // A `.default()` here would turn a mandatory agreement into an optional one for every
      // caller that is not the browser form. Absent has to be as invalid as false.
      const result = ClinicOnlySchema.safeParse({ ...base, consents: { ...consents } });
      expect(result.success).toBe(false);
    });
  });
});

/**
 * The clinic's contact address. Distinct from `User.email`, which is a sign-in credential and is
 * not editable from this form — so the cases that matter are that it round-trips, that an empty
 * value is allowed, and that a typo is caught before it becomes an address nothing can reach.
 */
describe('ClinicProfileSchema.email', () => {
  const parseEmail = (email: string) => ClinicProfileSchema.safeParse({ ...base, email });

  it.each([
    ['a plain address', 'hello@clinic.ge'],
    ['a subdomain', 'contact@mail.clinic.co.uk'],
    ['a plus tag', 'reception+billing@clinic.ge'],
  ])('accepts %s', (_label, value) => {
    const result = parseEmail(value);
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe(value);
  });

  it('accepts an empty value — a clinic must be able to save the rest of the form without one', () => {
    expect(parseEmail('').success).toBe(true);
  });

  it('defaults to an empty string when the field is absent entirely', () => {
    const result = ClinicProfileSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('');
  });

  it('trims a pasted address rather than rejecting it for its whitespace', () => {
    const result = parseEmail('  hello@clinic.ge  ');
    expect(result.success && result.data.email).toBe('hello@clinic.ge');
  });

  it.each([
    ['no @', 'hello.clinic.ge'],
    ['no domain', 'hello@'],
    ['no local part', '@clinic.ge'],
    ['an embedded space', 'hello world@clinic.ge'],
  ])('rejects an address with %s', (_label, value) => {
    const result = parseEmail(value);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe('INVALID_EMAIL');
  });

  it('reports the failure under the field, so the form shows it beneath the input', () => {
    const result = parseEmail('nope');
    expect(!result.success && result.error.issues[0].path).toEqual(['email']);
  });

  it('is savable on its own through the settings PATCH', () => {
    const result = UpdateClinicSchema.safeParse({ email: 'hello@clinic.ge' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('hello@clinic.ge');
  });

  it('blocks a settings PATCH carrying a malformed address', () => {
    expect(UpdateClinicSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});
