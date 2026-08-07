import { describe, expect, it } from 'vitest';

import { TAX_ID_ISSUES } from '@/shared/const/tax-id.const';
import { normaliseTaxId, taxIdIssue } from '@/shared/utils/tax-id';

describe('normaliseTaxId', () => {
  it.each([
    ['surrounding whitespace', '  204567891  ', '204567891'],
    ['grouping spaces', 'FR 12 345678901', 'FR12345678901'],
    ['EIN hyphen', '12-3456789', '123456789'],
    ['NIP hyphens', '123-456-32-18', '1234563218'],
    ['a pasted newline', 'DE123\n456789', 'DE123456789'],
    ['a non-breaking space', 'DE123 456789', 'DE123456789'],
  ])('strips %s', (_label, input, expected) => {
    expect(normaliseTaxId(input)).toBe(expected);
  });

  it('leaves case alone — it carries no meaning and rewriting it surprises the clinic', () => {
    expect(normaliseTaxId('de123456789')).toBe('de123456789');
  });
});

/**
 * The rule is country-aware, which is the whole point: the same nine digits are a valid Georgian
 * identification code, a valid German VAT body and an invalid Swedish one. Each case below is a
 * real format from a market the product is sold into.
 */
describe('taxIdIssue', () => {
  it('accepts an empty value — the number raises an invoice, it does not open an account', () => {
    expect(taxIdIssue('', 'Georgia')).toBeNull();
  });

  it.each([
    ['an ASCII code', 'GE'],
    ['the English name', 'Georgia'],
    ['the Georgian name', 'საქართველო'],
    ['a lowercase code', 'ge'],
  ])('resolves Georgia from %s', (_label, country) => {
    expect(taxIdIssue('204567891', country)).toBeNull();
  });

  it.each([
    ['a 9-digit legal entity code', '204567891'],
    ['an 11-digit personal number', '01001012345'],
  ])('accepts %s for Georgia', (_label, value) => {
    expect(taxIdIssue(value, 'Georgia')).toBeNull();
  });

  it.each([
    ['8 digits', '20456789'],
    ['10 digits', '2045678912'],
    ['12 digits', '204567891234'],
    ['letters', 'GE20456789'],
  ])('rejects %s for Georgia', (_label, value) => {
    expect(taxIdIssue(value, 'Georgia')).toBe(TAX_ID_ISSUES.georgian);
  });

  it.each([
    ['German VAT with prefix', 'DE123456789', 'Germany'],
    ['German VAT without prefix', '123456789', 'Germany'],
    ['a lowercase prefix', 'de123456789', 'Germany'],
    ['French VAT', 'FR12345678901', 'France'],
    ['Dutch VAT with its B block', 'NL123456789B01', 'Netherlands'],
    ['Polish NIP', '1234563218', 'Poland'],
    ['Greek VAT under its EL prefix', 'EL123456789', 'Greece'],
    ['Austrian VAT', 'ATU12345678', 'Austria'],
    ['Irish VAT', 'IE1234567FA', 'Ireland'],
  ])('accepts %s', (_label, value, country) => {
    expect(taxIdIssue(value, country)).toBeNull();
  });

  it.each([
    ['a digit short', 'DE12345678', 'Germany'],
    ['a digit too many', 'DE1234567890', 'Germany'],
    ['another country prefix', 'FR123456789', 'Germany'],
    ['the country code where EL is required', 'GR123456789', 'Greece'],
    ['a Swedish number of German length', '123456789', 'Sweden'],
  ])('rejects %s', (_label, value, country) => {
    expect(taxIdIssue(value, country)).toBe(TAX_ID_ISSUES.vat);
  });

  it.each([
    ['a US EIN', '123456789', 'United States'],
    ['a UK company number', 'SC123456', 'United Kingdom'],
    ['a value under a country we cannot resolve', 'ABC12345', 'Narnia'],
    ['a value with no country given at all', 'ABC12345', ''],
  ])('accepts %s under the generic rule', (_label, value, country) => {
    expect(taxIdIssue(value, country)).toBeNull();
  });

  it.each([
    ['shorter than five characters', 'AB12'],
    ['longer than fifteen characters', 'A234567890123456'],
  ])('rejects a generic value %s', (_label, value) => {
    expect(taxIdIssue(value, 'United States')).toBe(TAX_ID_ISSUES.length);
  });

  it.each([
    ['a slash', '12/3456789'],
    ['a comma', 'DE123,456789'],
    ['a plus sign that survived sanitising', 'DE123+456789'],
  ])('rejects %s before any country rule runs', (_label, value) => {
    expect(taxIdIssue(value, 'Germany')).toBe(TAX_ID_ISSUES.characters);
  });
});
