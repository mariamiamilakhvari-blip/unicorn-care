import {
  EU_VAT_RULES,
  GEORGIAN_TAX_ID,
  TAX_ID_ALPHANUMERIC,
  TAX_ID_ISSUES,
  TAX_ID_MAX_LENGTH,
  TAX_ID_MIN_LENGTH,
  TaxIdIssue,
} from '@/shared/const/tax-id.const';
import { toCountryCode } from '@/shared/utils/country';

/**
 * Strips every separator a registration number is quoted with.
 *
 * Real numbers are printed with grouping: `12-3456789` on a US EIN letter, `FR 12 345678901` on
 * an invoice, `123-456-32-18` on a Polish NIP. Those are typography, not data — the number is the
 * alphanumerics. Normalising on the way in means one clinic's `123-456-32-18` and another's
 * `1234563218` are the same stored value, and the per-country patterns only ever face one shape.
 *
 * Case is deliberately preserved: it carries no meaning here, and rewriting what a clinic typed
 * into its own settings field is a worse surprise than a lowercase prefix.
 */
export function normaliseTaxId(value: string): string {
  return value.replace(/[\s-]+/g, '');
}

/** Whether a sanitised value is a valid VAT number for `code`, with or without its letter prefix. */
function matchesEuVat(value: string, prefix: string, body: RegExp): boolean {
  const withoutPrefix = value.toUpperCase().startsWith(prefix)
    ? value.slice(prefix.length)
    : value;

  return body.test(withoutPrefix);
}

/**
 * The tax ID rule, as one country-aware function so the form, the register endpoint and the
 * settings PATCH cannot disagree about what a valid number is.
 *
 * Takes the *sanitised* value and the raw country field — `toCountryCode` resolves "Georgia",
 * "საქართველო" and "GE" alike, because the country input is free text and always has been.
 *
 * Returns `null` when the value is acceptable, otherwise the code the form translates:
 * - empty passes. The number raises an invoice, it does not open an account, and a clinic whose
 *   registration number is with its accountant must still be able to sign up.
 * - Georgia: 9 digits (legal entity) or 11 (individual entrepreneur), digits only.
 * - EU member: that country's VAT format, prefix optional.
 * - anywhere else: 5–15 alphanumerics, which is the range every remaining national format fits.
 */
export function taxIdIssue(taxId: string, country: string): TaxIdIssue | null {
  if (taxId === '') return null;
  if (!TAX_ID_ALPHANUMERIC.test(taxId)) return TAX_ID_ISSUES.characters;

  const code = toCountryCode(country);
  if (code === 'GE') {
    return GEORGIAN_TAX_ID.test(taxId) ? null : TAX_ID_ISSUES.georgian;
  }

  const vat = code ? EU_VAT_RULES[code] : undefined;
  if (vat) {
    return matchesEuVat(taxId, vat.prefix, vat.body) ? null : TAX_ID_ISSUES.vat;
  }

  const withinBounds = taxId.length >= TAX_ID_MIN_LENGTH && taxId.length <= TAX_ID_MAX_LENGTH;
  return withinBounds ? null : TAX_ID_ISSUES.length;
}
