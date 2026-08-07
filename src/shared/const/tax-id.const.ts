import { CountryCode } from '@/shared/const/country.const';

/**
 * The failure codes the tax ID rule can raise.
 *
 * They travel on the wire as `message`, exactly as `INVALID_TIMEZONE` and the original
 * `INVALID_TAX_ID` already do, and are translated at the form. Four codes rather than one because
 * "this is not a Georgian ID" and "this is not a German VAT number" need different sentences —
 * a clinic that is told only "invalid" has to guess which of the two rules it broke.
 */
export const TAX_ID_ISSUES = {
  characters: 'INVALID_TAX_ID',
  georgian: 'INVALID_TAX_ID_GE',
  vat: 'INVALID_TAX_ID_VAT',
  length: 'INVALID_TAX_ID_LENGTH',
} as const;

export type TaxIdIssue = (typeof TAX_ID_ISSUES)[keyof typeof TAX_ID_ISSUES];

/** Message key under the `clinic` namespace for each code. Rendered by `ClinicProfileFields`. */
export const TAX_ID_MESSAGE_KEYS: Record<TaxIdIssue, string> = {
  [TAX_ID_ISSUES.characters]: 'taxIdInvalid',
  [TAX_ID_ISSUES.georgian]: 'taxIdInvalidGe',
  [TAX_ID_ISSUES.vat]: 'taxIdInvalidVat',
  [TAX_ID_ISSUES.length]: 'taxIdInvalidLength',
};

/** Everything that survives sanitising has to be one of these. Separators are stripped, not kept. */
export const TAX_ID_ALPHANUMERIC = /^[A-Za-z0-9]+$/;

/**
 * Georgia issues two numbers into this one field: a 9-digit identification code for a legal
 * entity (LLC, LTD) and an 11-digit personal number for an individual entrepreneur. Both are
 * digits only — a letter here is always a typo, never a format.
 */
export const GEORGIAN_TAX_ID = /^(\d{9}|\d{11})$/;

/** The fallback for every country without a codified rule below. */
export const TAX_ID_MIN_LENGTH = 5;
export const TAX_ID_MAX_LENGTH = 15;

/**
 * EU VAT number formats, keyed by ISO 3166-1 alpha-2.
 *
 * `prefix` is the letter pair the number is quoted with, which is *not* always the country code:
 * Greece uses `EL`. `body` matches what follows it. Both forms are accepted at the field — a
 * clinic that types `DE123456789` and one that types `123456789` under Germany mean the same
 * number, and rejecting either is a support ticket.
 *
 * Matching is case-insensitive at the call site, so `de123456789` is fine.
 */
export const EU_VAT_RULES: Partial<Record<CountryCode, { prefix: string; body: RegExp }>> = {
  AT: { prefix: 'AT', body: /^U\d{8}$/i },
  BE: { prefix: 'BE', body: /^[01]\d{9}$/ },
  BG: { prefix: 'BG', body: /^\d{9,10}$/ },
  CY: { prefix: 'CY', body: /^\d{8}[A-Z]$/i },
  CZ: { prefix: 'CZ', body: /^\d{8,10}$/ },
  DE: { prefix: 'DE', body: /^\d{9}$/ },
  DK: { prefix: 'DK', body: /^\d{8}$/ },
  EE: { prefix: 'EE', body: /^\d{9}$/ },
  ES: { prefix: 'ES', body: /^[A-Z0-9]\d{7}[A-Z0-9]$/i },
  FI: { prefix: 'FI', body: /^\d{8}$/ },
  FR: { prefix: 'FR', body: /^[A-Z0-9]{2}\d{9}$/i },
  GR: { prefix: 'EL', body: /^\d{9}$/ },
  HR: { prefix: 'HR', body: /^\d{11}$/ },
  HU: { prefix: 'HU', body: /^\d{8}$/ },
  IE: { prefix: 'IE', body: /^(\d{7}[A-W][A-I]?|\d[A-Z*+]\d{5}[A-W])$/i },
  IT: { prefix: 'IT', body: /^\d{11}$/ },
  LT: { prefix: 'LT', body: /^(\d{9}|\d{12})$/ },
  LU: { prefix: 'LU', body: /^\d{8}$/ },
  LV: { prefix: 'LV', body: /^\d{11}$/ },
  MT: { prefix: 'MT', body: /^\d{8}$/ },
  NL: { prefix: 'NL', body: /^\d{9}B\d{2}$/i },
  PL: { prefix: 'PL', body: /^\d{10}$/ },
  PT: { prefix: 'PT', body: /^\d{9}$/ },
  RO: { prefix: 'RO', body: /^\d{2,10}$/ },
  SE: { prefix: 'SE', body: /^\d{12}$/ },
  SI: { prefix: 'SI', body: /^\d{8}$/ },
  SK: { prefix: 'SK', body: /^\d{10}$/ },
};
