import { describe, expect, it } from 'vitest';

import { toCountryCode } from '@/shared/utils/country';

describe('toCountryCode', () => {
  it.each([
    ['Georgia', 'GE'],
    ['საქართველო', 'GE'],
    ['Germany', 'DE'],
    ['გერმანია', 'DE'],
    ['United Kingdom', 'GB'],
    ['United States', 'US'],
  ])('resolves %s to %s', (input, expected) => {
    expect(toCountryCode(input)).toBe(expected);
  });

  it.each([
    ['GE', 'GE'],
    ['ge', 'GE'],
    ['  de  ', 'DE'],
  ])('accepts %s as an alpha-2 code already', (input, expected) => {
    expect(toCountryCode(input)).toBe(expected);
  });

  it('is insensitive to case and stray whitespace in a name', () => {
    expect(toCountryCode('  united   states ')).toBe('US');
  });

  it.each([['', 'empty'], ['   ', 'whitespace'], ['Atlantis', 'not a country'], ['XX', 'unassigned code']])(
    'returns null for %s (%s)',
    input => {
      // Guessing here would send an invalid country to the payment API and 422 the checkout,
      // which costs the clinic the whole purchase. Dropping the tax details costs a VAT line.
      expect(toCountryCode(input)).toBeNull();
    }
  );
});
