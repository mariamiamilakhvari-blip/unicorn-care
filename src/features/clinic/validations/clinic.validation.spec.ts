import { describe, expect, it } from 'vitest';

import { ClinicSignUpSchema } from '@/features/clinic/validations/clinic-signup.validation';
import {
  ClinicProfileSchema,
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
    consents: {
      terms: true,
      privacy: true,
      patientConsents: true,
      accuracy: true,
      credentials: true,
      processingPurpose: true,
      remindersNotMedicalAdvice: true,
      regulatoryCompliance: true,
    },
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
