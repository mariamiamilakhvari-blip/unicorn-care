/**
 * The Georgian Public Registry (NAPR) lookup, as constants.
 *
 * There is no documented JSON API. `enreg.reestri.gov.ge` is a jQuery portal whose search form
 * posts to `main.php` and swaps the returned HTML fragment into the page, so the "API" here is
 * that same POST — the one the public search box itself uses — and the response is a table we
 * parse. Everything brittle about that arrangement is pinned to this file so a change at the
 * registry is a data edit rather than a hunt through the client.
 */
export const NAPR_ENDPOINT = 'https://enreg.reestri.gov.ge/main.php';

/**
 * The controller/method pair the portal's own `search_legal_person_by_name` uses. Sent as form
 * fields, not query params — a GET to the same URL returns the shell page, not results.
 */
export const NAPR_SEARCH_PARAMS = { c: 'search', m: 'find_legal_persons' } as const;

/** Form field the identification code travels in. Its sibling `s_legal_person_name` goes empty. */
export const NAPR_TAX_ID_FIELD = 's_legal_person_idnumber';
export const NAPR_NAME_FIELD = 's_legal_person_name';

/**
 * Short on purpose. This runs while a clinic waits on a registration form with a spinner in the
 * field, and a state registry that has stopped answering should read as "type it yourself" within
 * a few seconds rather than hold the form open for the length of a default fetch timeout.
 */
export const NAPR_REQUEST_TIMEOUT_MS = 8_000;

/** What the registry prints instead of a result row. Matched as a substring, not an equality. */
export const NAPR_NOT_FOUND_MARKER = 'ჩანაწერები არ მოიძებნა';

/**
 * A result row has six cells and a miss has one (`colspan="6"`), so the cell count *is* the
 * found/not-found signal. Checked as well as the marker above: the marker is Georgian prose and
 * could be reworded, while a row that does not have six cells cannot be read positionally at all.
 */
export const NAPR_ROW_CELL_COUNT = 6;

/**
 * Which cell holds what. The table has no classes, ids or headers tying a value to a column —
 * only position — so these indices are the entire contract. Cell 0 is the info-page link icon.
 *
 * `taxId` and `personalId` are two columns because the registry files the two kinds of business
 * under different ones, and exactly one is populated per row: a company carries a 9-digit
 * identification code in `taxId` with `personalId` blank, while an individual entrepreneur carries
 * an 11-digit personal number in `personalId` with `taxId` blank. Reading only the first would
 * report every sole trader in Georgia as not registered.
 */
export const NAPR_CELLS = { taxId: 1, personalId: 2, legalName: 3, status: 5 } as const;

/**
 * Registration status, normalised.
 *
 * The registry answers in Georgian prose. Passing that straight through would put an untranslated
 * Georgian string in front of an English-locale clinic and make every consumer a parser of
 * Georgian, so it is mapped to a code here and translated at the form like every other code in
 * this codebase.
 */
export const COMPANY_STATUSES = [
  'active',
  'registered',
  'suspended',
  'liquidating',
  'cancelled',
  'insolvent',
  'unknown',
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

/**
 * Registry wording → status code, matched as a prefix on the normalised cell text.
 *
 * A prefix rather than an exact match because several of these are printed with a trailing
 * qualifier — "ლიკვიდაციის პროცესში (გადაწყვეტილება ...)" — and the qualifier is not something we
 * can enumerate. Order matters: the first entry whose key the text starts with wins, so longer
 * and more specific wordings are listed before the short ones they contain.
 *
 * Anything unmatched becomes `unknown`, which the form shows as a plain "status not recognised"
 * rather than suppressing — a clinic whose registry entry we cannot classify still registered.
 */
export const NAPR_STATUS_PREFIXES: ReadonlyArray<readonly [string, CompanyStatus]> = [
  ['გადახდისუუნარობის', 'insolvent'],
  ['ლიკვიდაციის', 'liquidating'],
  ['რეგისტრირებული', 'registered'],
  ['შეჩერებული', 'suspended'],
  ['გაუქმებული', 'cancelled'],
  ['აქტიური', 'active'],
];

/** Message key under the `clinic` namespace for each status. Rendered beside the tax ID field. */
export const COMPANY_STATUS_MESSAGE_KEYS: Record<CompanyStatus, string> = {
  active: 'companyStatusActive',
  registered: 'companyStatusRegistered',
  suspended: 'companyStatusSuspended',
  liquidating: 'companyStatusLiquidating',
  cancelled: 'companyStatusCancelled',
  insolvent: 'companyStatusInsolvent',
  unknown: 'companyStatusUnknown',
};

/**
 * Why a lookup produced nothing, as the codes `GET /api/company/lookup` answers with.
 *
 * A malformed code and an unregistered one collapse to the same sentence for the clinic — both
 * mean "the registry has nothing for what you typed", and the field's own validation already says
 * what a well-formed code looks like. An unreachable registry does not collapse into them: telling
 * a clinic its company is not registered because a government server timed out is a lie the clinic
 * cannot act on.
 */
export const COMPANY_LOOKUP_MESSAGE_KEYS: Record<string, string> = {
  NOT_FOUND: 'companyNotFound',
  INVALID_LOOKUP_TAX_ID: 'companyNotFound',
  REGISTRY_UNAVAILABLE: 'companyRegistryUnavailable',
  RATE_LIMITED: 'companyLookupThrottled',
};

/** Debounce on the tax ID field. Long enough to cover typing a 9-digit code without firing twice. */
export const COMPANY_LOOKUP_DEBOUNCE_MS = 500;

/**
 * What the registry can be asked about: a 9-digit company code or an 11-digit personal number.
 *
 * Deliberately the same rule as `GEORGIAN_TAX_ID`, and re-exported from it rather than written out
 * again — two regexes that have to agree eventually stop agreeing. It was briefly narrower, on the
 * assumption that the legal-persons search only answered on company codes. It does not: searching
 * an 11-digit personal number returns that person's `ინდივიდუალური მეწარმე` registration, verified
 * against live records.
 */
export { GEORGIAN_TAX_ID as NAPR_LOOKUP_TAX_ID } from '@/shared/const/tax-id.const';

/**
 * The example shown in the field's placeholder.
 *
 * Deliberately a number in the right *shape* that no entity actually holds — verified against the
 * registry, which returns no record for it. A real company's code here would be a real company's
 * details auto-filling into a stranger's registration form the moment they tabbed past the
 * placeholder-shaped value, and it would name one clinic's competitor inside another's signup.
 */
export const NAPR_EXAMPLE_TAX_ID = '204567891';
