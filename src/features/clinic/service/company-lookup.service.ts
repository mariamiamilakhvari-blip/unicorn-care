import { CompanyLookupResponse } from '@/features/clinic/types/clinic.types';
import { CompanyLookupQuerySchema } from '@/features/clinic/validations/company-lookup.validation';
import { naprClient } from '@/shared/lib/napr-client';
import { ServiceResult } from '@/shared/types/common';

/**
 * Looks a clinic's own legal entity up in the Georgian Public Registry so registration can be
 * pre-filled from it.
 *
 * No repository: there is nothing of ours to read. This is the one service that talks to an
 * outbound client instead, which is why the client lives in `shared/lib` alongside the Dodo and
 * Resend ones rather than pretending to be a data layer.
 *
 * Three distinct failures, three distinct statuses, because the form does something different with
 * each: a malformed code is the clinic's to fix (400), an unknown code means type the details in
 * (404), and a registry that will not answer is nobody's fault and must not read as "your company
 * does not exist" (503).
 */
export async function lookupCompanyService(taxId: string): Promise<ServiceResult<CompanyLookupResponse>> {
  const parsed = CompanyLookupQuerySchema.safeParse({ taxId });
  if (!parsed.success) {
    return { data: { error: 'INVALID_LOOKUP_TAX_ID' }, status: 400 };
  }

  const result = await naprClient.findByTaxId(parsed.data.taxId);

  if (!result.ok) {
    const status = result.reason === 'NOT_FOUND' ? 404 : 503;
    return { data: { error: result.reason }, status };
  }

  return {
    data: {
      success: true,
      data: {
        taxId: result.company.taxId,
        legalName: result.company.legalName,
        /*
          Always empty. The registry publishes an address only behind a CAPTCHA, which is it saying
          it does not want that page automated — so the clinic fills these two in itself. Present
          in the response because the shape is the contract, not because the value is pending.
        */
        address: '',
        city: '',
        status: result.company.status,
      },
    },
    status: 200,
  };
}
