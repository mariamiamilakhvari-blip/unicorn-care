import {
  CompanyStatus,
  NAPR_CELLS,
  NAPR_ENDPOINT,
  NAPR_NAME_FIELD,
  NAPR_NOT_FOUND_MARKER,
  NAPR_REQUEST_TIMEOUT_MS,
  NAPR_ROW_CELL_COUNT,
  NAPR_SEARCH_PARAMS,
  NAPR_STATUS_PREFIXES,
  NAPR_TAX_ID_FIELD,
} from '@/shared/const/napr.const';

/** What the registry can tell us about an entity, before the service shapes it for the wire. */
export type NaprCompany = {
  taxId: string;
  legalName: string;
  status: CompanyStatus;
  /** The registry's own status wording, kept so an unmapped status is still diagnosable. */
  statusText: string;
};

export type NaprLookupResult =
  | { ok: true; company: NaprCompany }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'REGISTRY_UNAVAILABLE' };

/** Matches every `<td …>…</td>` in a chunk, capturing the inner HTML. */
const CELL_PATTERN = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;

/** The first data row of the results table — `<tbody>` holds nothing else. */
const FIRST_ROW_PATTERN = /<tbody[^>]*>[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>/i;

const TAG_PATTERN = /<[^>]*>/g;

/**
 * Server-only client for the Georgian Public Registry's legal-entity search.
 *
 * Never throws. A registry that is down, slow or has changed its markup returns a failure shape,
 * because the only caller is a convenience lookup on a registration form — a clinic must always
 * be able to finish registering by typing its own details, and an outage here must never be able
 * to turn into a 500 on that form.
 *
 * ## What this deliberately does not fetch
 *
 * The registry serves an entity's **address** only on its detail page (`m=show_legal_person`),
 * which is behind a CAPTCHA — requesting it without one answers
 * "მითითებული კოდი არ ემთხვევა ნახატზე გამოსახულს" ("the code does not match the image"). That
 * gate is the registry stating it does not want the page automated, so we do not automate it, and
 * `address`/`city` are left for the clinic to fill in. The search below is the portal's own public
 * search box, is not gated, and is the only call made here.
 */
class NaprClient {
  /**
   * Looks up a legal entity by its 9-digit identification code.
   *
   * The caller is responsible for validating the shape of `taxId`; this sends what it is given.
   */
  async findByTaxId(taxId: string): Promise<NaprLookupResult> {
    const html = await this.search(taxId);
    if (html === null) return { ok: false, reason: 'REGISTRY_UNAVAILABLE' };

    return this.parse(html, taxId);
  }

  /** The raw POST. Returns `null` for anything that is not a usable 2xx body. */
  private async search(taxId: string): Promise<string | null> {
    try {
      const response = await fetch(NAPR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          ...NAPR_SEARCH_PARAMS,
          [NAPR_TAX_ID_FIELD]: taxId,
          [NAPR_NAME_FIELD]: '',
        }).toString(),
        signal: AbortSignal.timeout(NAPR_REQUEST_TIMEOUT_MS),
        // The registry sets a session cookie we neither need nor want to carry between clinics.
        cache: 'no-store',
      });

      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }

  /**
   * Reads the result row.
   *
   * Positional, because the table gives us nothing else to key on — no headers, ids or classes tie
   * a value to a column. So the row is only trusted when it has exactly the expected number of
   * cells: a miss renders as a single `colspan="6"` cell, and a re-columned table would otherwise
   * be read as an entity with the wrong name silently filled into a clinic's registration.
   */
  private parse(html: string, requestedTaxId: string): NaprLookupResult {
    if (html.includes(NAPR_NOT_FOUND_MARKER)) return { ok: false, reason: 'NOT_FOUND' };

    const row = FIRST_ROW_PATTERN.exec(html)?.[1];
    if (!row) return { ok: false, reason: 'REGISTRY_UNAVAILABLE' };

    const cells = [...row.matchAll(CELL_PATTERN)].map(match => this.text(match[1]));
    if (cells.length !== NAPR_ROW_CELL_COUNT) return { ok: false, reason: 'REGISTRY_UNAVAILABLE' };

    const legalName = cells[NAPR_CELLS.legalName];

    /*
      Either identifier column may carry the match: a company files under its 9-digit code, a sole
      trader under their 11-digit personal number, and the other column is blank. Both are checked
      because the field accepts both.

      The search matches on more than exact equality, so a row carrying neither identifier we asked
      about is not this clinic's entity. Treated as a miss rather than returned: filling a
      registration form with a company the clinic did not ask for is worse than filling nothing.
    */
    /*
      Blanks are filtered before matching, not after. Exactly one identifier column is populated
      per row, so leaving the empty one in would make an empty request match every row in the
      registry — `''` is a legitimate value of the column the entity does not file under.
    */
    const identifiers = [cells[NAPR_CELLS.taxId], cells[NAPR_CELLS.personalId]].filter(Boolean);
    if (!identifiers.includes(requestedTaxId) || legalName === '') {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    const statusText = cells[NAPR_CELLS.status];

    return {
      ok: true,
      company: { taxId: requestedTaxId, legalName, status: this.status(statusText), statusText },
    };
  }

  /** Cell HTML → the text a person would read: tags gone, entities decoded, whitespace collapsed. */
  private text(cell: string): string {
    return cell
      .replace(TAG_PATTERN, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private status(statusText: string): CompanyStatus {
    const match = NAPR_STATUS_PREFIXES.find(([prefix]) => statusText.startsWith(prefix));
    return match ? match[1] : 'unknown';
  }
}

export const naprClient = new NaprClient();
export { NaprClient };
