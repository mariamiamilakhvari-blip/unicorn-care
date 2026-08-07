import { BAA_REQUIRED_COUNTRY } from '@/shared/const/consent.const';
import { toCountryCode } from '@/shared/utils/country';

/**
 * Whether a clinic in this country must accept the Business Associate Agreement to register.
 *
 * HIPAA reaches US Covered Entities, so that is where the box is mandatory. Everywhere else it is
 * offered and recorded but never blocks: a Georgian clinic is not a party to a BAA, and a
 * checkbox it was forced to tick is evidence of nothing.
 *
 * The country field is free text, so this goes through the same resolver the tax ID rule uses —
 * "United States", "US" and "us" all reach the same answer, and a country we cannot resolve is
 * treated as not-US rather than guessed at.
 */
export function requiresBaa(country: string): boolean {
  return toCountryCode(country) === BAA_REQUIRED_COUNTRY;
}
