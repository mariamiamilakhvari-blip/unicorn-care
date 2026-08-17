import { z } from 'zod';

import { NAPR_LOOKUP_TAX_ID } from '@/shared/const/napr.const';

/**
 * `GET /api/company/lookup?taxId=…`.
 *
 * A query schema rather than a body schema, so it is parsed from `searchParams` instead of through
 * `validateBody` — the lookup is a read and has no body to validate.
 *
 * The rule is a Georgian number — 9 digits for a company, 11 for an individual entrepreneur —
 * checked before anything leaves the process. Still narrower than the tax ID field's own rule,
 * which also accepts every EU VAT format: filtering here means a clinic in Germany typing its VAT
 * number never causes an outbound request to a Georgian state registry that could not know it.
 */
export const CompanyLookupQuerySchema = z.object({
  taxId: z.string().regex(NAPR_LOOKUP_TAX_ID, { message: 'INVALID_LOOKUP_TAX_ID' }),
});

export type CompanyLookupQueryType = z.infer<typeof CompanyLookupQuerySchema>;
