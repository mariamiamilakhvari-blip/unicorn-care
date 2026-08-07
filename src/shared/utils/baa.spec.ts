import { describe, expect, it } from 'vitest';

import { requiresBaa } from '@/shared/utils/baa';

/**
 * The whole rule is "is this clinic in the United States", but the country field is free text, so
 * the ways of saying so are what actually need pinning.
 */
describe('requiresBaa', () => {
  it.each([
    ['an ISO code', 'US'],
    ['a lowercase code', 'us'],
    ['the English name', 'United States'],
    ['the name with surrounding whitespace', '  United States  '],
    ['the Georgian name', 'ამერიკის შეერთებული შტატები'],
  ])('requires a BAA for %s', (_label, country) => {
    expect(requiresBaa(country)).toBe(true);
  });

  it('matches the country name exactly, and does not guess from a fragment', () => {
    // `toCountryCode` is an exact index, not a search. A near-miss resolves to nothing and the
    // clinic is treated as non-US — the box is then optional rather than wrongly enforced.
    expect(requiresBaa('შეერთებული შტატები')).toBe(false);
  });

  it.each([
    ['Georgia', 'Georgia'],
    ['Georgia in Georgian', 'საქართველო'],
    ['Germany', 'Germany'],
    ['the United Kingdom, which is not the US', 'United Kingdom'],
    ['a country we cannot resolve', 'Narnia'],
    ['an empty field', ''],
  ])('does not require one for %s', (_label, country) => {
    expect(requiresBaa(country)).toBe(false);
  });
});
