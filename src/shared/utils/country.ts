import { COUNTRY_CODES, CountryCode } from '@/shared/const/country.const';

/** The locales a clinic could plausibly have typed its country in. */
const LOOKUP_LOCALES = ['en', 'ka'] as const;

/**
 * Country name → alpha-2, built once per process.
 *
 * `Intl.DisplayNames` only goes code → name, so the reverse map is assembled by walking every
 * code in both locales. Doing it lazily rather than at import keeps it off the cold-start path of
 * requests that never touch billing.
 */
let reverseIndex: Map<string, CountryCode> | null = null;

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

function buildIndex(): Map<string, CountryCode> {
  const index = new Map<string, CountryCode>();

  for (const locale of LOOKUP_LOCALES) {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    for (const code of COUNTRY_CODES) {
      const name = names.of(code);
      // `of()` echoes the code back when it has no translation — not a name, so not an entry.
      if (name && name !== code) index.set(normalise(name), code);
    }
  }

  return index;
}

/**
 * Resolves whatever a clinic typed into the country field to an ISO 3166-1 alpha-2 code.
 *
 * The field is free text and always has been, but the payment provider's billing address takes
 * alpha-2 only, and it is a hard requirement for attaching a tax ID to a B2B invoice. So
 * "Georgia", "საქართველო" and "ge" all have to arrive as `GE`.
 *
 * Returns `null` rather than guessing when nothing matches. The caller drops the tax details in
 * that case: an invoice without a VAT number is a nuisance, a checkout that 422s because we
 * invented a country code is a clinic that cannot pay at all.
 */
export function toCountryCode(input: string): CountryCode | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a code — accept it directly rather than round-tripping through a display name.
  const upper = trimmed.toUpperCase();
  if ((COUNTRY_CODES as readonly string[]).includes(upper)) return upper as CountryCode;

  reverseIndex ??= buildIndex();
  return reverseIndex.get(normalise(trimmed)) ?? null;
}
