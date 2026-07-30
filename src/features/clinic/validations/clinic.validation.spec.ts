import { describe, expect, it } from 'vitest';

import { ClinicProfileSchema } from '@/features/clinic/validations/clinic.validation';

const base = {
  name: 'Unicorn Clinic',
  country: 'Georgia',
  city: 'Tbilisi',
  addressLine: '12 Rustaveli',
  phone: '+995555000111',
  locale: 'ka' as const,
  timezone: 'Asia/Tbilisi',
};

const parseTaxId = (taxId: string) => ClinicProfileSchema.safeParse({ ...base, taxId });

/**
 * The point of this field is that it is not a Georgian field. Each of these is a real registration
 * format from a market the product is sold into, so a regex change that quietly excludes one of
 * them fails here rather than at a clinic's first invoice.
 */
describe('ClinicProfileSchema.taxId', () => {
  it.each([
    ['Georgian tax ID', '204567891'],
    ['German VAT', 'DE123456789'],
    ['US EIN', '12-3456789'],
    ['UK company number', 'SC123456'],
    ['French VAT with spacing', 'FR 12 345678901'],
    ['Polish NIP with hyphens', '123-456-32-18'],
    ['lowercase prefix', 'de123456789'],
  ])('accepts a %s', (_label, value) => {
    const result = parseTaxId(value);
    expect(result.success).toBe(true);
    expect(result.success && result.data.taxId).toBe(value);
  });

  it('accepts an empty value, because it is collected for billing and not for sign-up', () => {
    const result = parseTaxId('');
    expect(result.success).toBe(true);
  });

  it('defaults to an empty string when the field is absent entirely', () => {
    const result = ClinicProfileSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.success && result.data.taxId).toBe('');
  });

  it('trims surrounding whitespace so a pasted value is not rejected', () => {
    const result = parseTaxId('  DE123456789  ');
    expect(result.success).toBe(true);
    expect(result.success && result.data.taxId).toBe('DE123456789');
  });

  it.each([
    ['a comma', 'DE123,456789'],
    ['a slash', '12/3456789'],
    ['an embedded newline', 'DE123\n456789'],
    ['a trailing separator', 'DE123456789-'],
    ['a doubled separator', 'DE123--456789'],
  ])('rejects %s', (_label, value) => {
    expect(parseTaxId(value).success).toBe(false);
  });

  it('rejects a value longer than the column allows', () => {
    expect(parseTaxId('A'.repeat(41)).success).toBe(false);
  });
});
