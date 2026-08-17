import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lookupCompanyService } from '@/features/clinic/service/company-lookup.service';
import { naprClient } from '@/shared/lib/napr-client';

vi.mock('@/shared/lib/napr-client');

const findByTaxId = vi.mocked(naprClient.findByTaxId);

describe('lookupCompanyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the registry entity in the wire envelope', async () => {
    findByTaxId.mockResolvedValue({
      ok: true,
      company: {
        taxId: '204378869',
        legalName: 'სს საქართველოს ბანკი',
        status: 'active',
        statusText: 'აქტიური',
      },
    });

    const result = await lookupCompanyService('204378869');

    expect(result).toEqual({
      status: 200,
      data: {
        success: true,
        data: {
          taxId: '204378869',
          legalName: 'სს საქართველოს ბანკი',
          address: '',
          city: '',
          status: 'active',
        },
      },
    });
  });

  /** The registry's own status wording is internal — it must not reach the wire untranslated. */
  it('does not leak the raw Georgian status text', async () => {
    findByTaxId.mockResolvedValue({
      ok: true,
      company: {
        taxId: '204378869',
        legalName: 'სს ბანკი',
        status: 'active',
        statusText: 'აქტიური',
      },
    });

    const result = await lookupCompanyService('204378869');

    expect(JSON.stringify(result)).not.toContain('statusText');
  });

  it.each([
    ['20437886', 'eight digits'],
    ['2043788690', 'ten digits'],
    ['20437886a', 'a letter'],
    ['', 'nothing at all'],
    ['DE123456789', 'an EU VAT number'],
  ])('rejects %s (%s) without calling the registry', async taxId => {
    const result = await lookupCompanyService(taxId);

    expect(result).toEqual({ data: { error: 'INVALID_LOOKUP_TAX_ID' }, status: 400 });
    expect(findByTaxId).not.toHaveBeenCalled();
  });

  /**
   * An individual entrepreneur registers under an 11-digit personal number rather than a company
   * code, and the registry answers on it. Rejecting it here would mean every sole trader gets no
   * lookup at all, on a product whose customers are mostly sole traders and small practices.
   */
  it('looks up an 11-digit personal number as well as a 9-digit company code', async () => {
    findByTaxId.mockResolvedValue({
      ok: true,
      company: {
        taxId: '01027081821',
        legalName: 'ინდივიდუალური მეწარმე გიორგი გუგეშაშვილი',
        status: 'active',
        statusText: 'აქტიური',
      },
    });

    const result = await lookupCompanyService('01027081821');

    expect(findByTaxId).toHaveBeenCalledWith('01027081821');
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      success: true,
      data: { taxId: '01027081821', status: 'active' },
    });
  });

  it('reports a code with no record as a 404', async () => {
    findByTaxId.mockResolvedValue({ ok: false, reason: 'NOT_FOUND' });

    expect(await lookupCompanyService('999999999')).toEqual({
      data: { error: 'NOT_FOUND' },
      status: 404,
    });
  });

  /**
   * Deliberately not a 404. "The registry is down" and "your company is not registered" are
   * different sentences, and showing the second when the first is true tells a clinic its own
   * legal entity does not exist.
   */
  it('separates an unreachable registry from a missing record', async () => {
    findByTaxId.mockResolvedValue({ ok: false, reason: 'REGISTRY_UNAVAILABLE' });

    expect(await lookupCompanyService('204378869')).toEqual({
      data: { error: 'REGISTRY_UNAVAILABLE' },
      status: 503,
    });
  });
});
