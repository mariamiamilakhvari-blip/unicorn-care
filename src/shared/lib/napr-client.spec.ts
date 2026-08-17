import { afterEach, describe, expect, it, vi } from 'vitest';

import { naprClient } from './napr-client';

/**
 * A real result row, reduced to the markup the parser actually depends on.
 *
 * `taxId` and `personalId` are separate because the registry populates exactly one of them: a
 * company fills the first, an individual entrepreneur the second.
 */
const row = (taxId: string, personalId: string, name: string, status: string) => `
  <table class="main_tbl">
    <thead><tr><th>&nbsp;</th><th>საიდენტიფიკაციო კოდი</th></tr></thead>
    <tbody>
      <tr bgcolor="#ffffff">
        <td valign="top"><a href="javascript:void(0)" onclick="show_legal_person(244586)">
          <img src="https://enreg.reestri.gov.ge/images/info.png"></a></td>
        <td valign="top"><span style="font-weight:bold">${taxId}</span><br/></td>
        <td valign="top"><span style="font-weight:bold">${personalId}</span><br/></td>
        <td valign="top"> ${name} </td>
        <td valign="top"> სააქციო საზოგადოება</td>
        <td valign="top"><span class="st1"> ${status}  </span></td>
      </tr>
    </tbody>
  </table>`;

/** What the registry returns for a code nobody holds: one cell, spanning the whole row. */
const NOT_FOUND_HTML = `
  <tbody><tr bgcolor="#FFFFFF">
    <td colspan="6" align="center">ჩანაწერები არ მოიძებნა</td>
  </tr></tbody>`;

/**
 * A fresh `Response` per call, deliberately — a body can only be read once, so a single shared
 * instance would make the second lookup in a test fail for a reason that has nothing to do with
 * the client.
 */
const mockFetch = (body: string, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(body, { status }));

describe('naprClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the identification code as the portal search form does', async () => {
    const fetchMock = mockFetch(row('204378869', '', 'სს საქართველოს ბანკი', 'აქტიური'));

    await naprClient.findByTaxId('204378869');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://enreg.reestri.gov.ge/main.php');
    expect(init?.method).toBe('POST');

    const sent = new URLSearchParams(String(init?.body));
    expect(sent.get('c')).toBe('search');
    expect(sent.get('m')).toBe('find_legal_persons');
    expect(sent.get('s_legal_person_idnumber')).toBe('204378869');
    expect(sent.get('s_legal_person_name')).toBe('');
  });

  it('reads the name and status out of the result row', async () => {
    mockFetch(row('204378869', '', 'სს საქართველოს ბანკი', 'აქტიური'));

    const result = await naprClient.findByTaxId('204378869');

    expect(result).toEqual({
      ok: true,
      company: {
        taxId: '204378869',
        legalName: 'სს საქართველოს ბანკი',
        status: 'active',
        statusText: 'აქტიური',
      },
    });
  });

  it('maps a status printed with a trailing qualifier by its leading wording', async () => {
    mockFetch(
      row('205111222', '', 'შპს კლინიკა', 'ლიკვიდაციის პროცესში (გადაწყვეტილება 01/02)')
    );

    const result = await naprClient.findByTaxId('205111222');

    expect(result).toMatchObject({ ok: true, company: { status: 'liquidating' } });
  });

  /** Unmapped wording must still return the entity — it is registered either way. */
  it('falls back to an unknown status rather than discarding the match', async () => {
    mockFetch(row('205111222', '', 'შპს კლინიკა', 'რაღაც ახალი სტატუსი'));

    const result = await naprClient.findByTaxId('205111222');

    expect(result).toMatchObject({
      ok: true,
      company: { status: 'unknown', statusText: 'რაღაც ახალი სტატუსი' },
    });
  });

  it('reports a code with no record as not found', async () => {
    mockFetch(NOT_FOUND_HTML);

    expect(await naprClient.findByTaxId('999999999')).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  /**
   * The row is read by column position, so a table that no longer has six columns cannot be read
   * at all. It must fail rather than fill a clinic's registration with a value from the wrong cell.
   */
  it('refuses a row whose column count has changed', async () => {
    mockFetch(`
      <tbody><tr>
        <td>icon</td><td>204378869</td><td>სს საქართველოს ბანკი</td><td>აქტიური</td>
      </tr></tbody>`);

    expect(await naprClient.findByTaxId('204378869')).toEqual({
      ok: false,
      reason: 'REGISTRY_UNAVAILABLE',
    });
  });

  /** Same reasoning: a row about a different entity is a miss, never a partial match to fill in. */
  it('rejects a row whose code is not the one asked about', async () => {
    mockFetch(row('111111111', '', 'შპს სხვა', 'აქტიური'));

    expect(await naprClient.findByTaxId('204378869')).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  /**
   * An individual entrepreneur files under a personal number in the second identifier column, with
   * the company-code column blank. Reading only the first would report every sole trader in
   * Georgia as unregistered — and sole traders are most of the small practices this product sells
   * to. Shape taken from a live record.
   */
  it('matches an individual entrepreneur on the personal number column', async () => {
    mockFetch(
      row('', '01027081821', 'ინდივიდუალური მეწარმე გიორგი გუგეშაშვილი', 'აქტიური')
    );

    const result = await naprClient.findByTaxId('01027081821');

    expect(result).toEqual({
      ok: true,
      company: {
        taxId: '01027081821',
        legalName: 'ინდივიდუალური მეწარმე გიორგი გუგეშაშვილი',
        status: 'active',
        statusText: 'აქტიური',
      },
    });
  });

  /** The blank column must never match a blank request — that would make every miss a hit. */
  it('does not match an empty identifier against a blank column', async () => {
    mockFetch(row('204378869', '', 'სს საქართველოს ბანკი', 'აქტიური'));

    expect(await naprClient.findByTaxId('')).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('reports an unavailable registry rather than throwing when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));

    expect(await naprClient.findByTaxId('204378869')).toEqual({
      ok: false,
      reason: 'REGISTRY_UNAVAILABLE',
    });
  });

  it('treats a non-2xx response as an unavailable registry', async () => {
    mockFetch('<html>502</html>', 502);

    expect(await naprClient.findByTaxId('204378869')).toEqual({
      ok: false,
      reason: 'REGISTRY_UNAVAILABLE',
    });
  });

  /** Two lookups in a row must parse identically — the cell regex is module-level and global. */
  it('parses consecutive lookups independently', async () => {
    mockFetch(row('204378869', '', 'სს საქართველოს ბანკი', 'აქტიური'));

    const first = await naprClient.findByTaxId('204378869');
    const second = await naprClient.findByTaxId('204378869');

    expect(second).toEqual(first);
  });
});
