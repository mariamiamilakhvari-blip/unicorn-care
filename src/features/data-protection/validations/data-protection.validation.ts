import { z } from 'zod';

import { CONSENT_TYPES } from '@/shared/const/consent-type.const';
import { DATA_REQUEST_DETAIL_MAX, DATA_REQUEST_KINDS } from '@/shared/const/data-request.const';

/**
 * `POST /api/patient-portal/consent` — the patient turning one consent on or off.
 *
 * `granted` is an explicit boolean rather than two endpoints because the portal renders a switch,
 * and a switch that posts to a different URL per direction is the shape that eventually sends the
 * wrong one. The service, not this schema, decides whether the type is one the patient may change
 * — that rule is `PATIENT_REVOCABLE_CONSENTS` and belongs where it can be explained in a 403.
 */
export const ConsentChangeSchema = z.object({
  type: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
});

export type ConsentChangeType = z.infer<typeof ConsentChangeSchema>;

/**
 * `POST /api/patient-portal/data-request` — a correction or erasure request.
 *
 * `detail` is required for a correction and optional for an erasure. The Law of Georgia on
 * Personal Data Protection asks no reason of someone requesting erasure, and demanding one would
 * be a condition the statute does not impose; a correction, on the other hand, is unactionable
 * without knowing what is wrong.
 */
export const DataRequestCreateSchema = z
  .object({
    kind: z.enum(DATA_REQUEST_KINDS),
    detail: z.string().max(DATA_REQUEST_DETAIL_MAX).default(''),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== 'correction') return;
    if (value.detail.trim().length > 0) return;

    ctx.addIssue({ code: 'custom', message: 'DETAIL_REQUIRED', path: ['detail'] });
  });

export type DataRequestCreateType = z.infer<typeof DataRequestCreateSchema>;

/** Pre-validation shape: `.default()` makes `detail` optional going in, required coming out. */
export type DataRequestFormType = z.input<typeof DataRequestCreateSchema>;

/**
 * `PATCH /api/data-requests/[id]` — the clinic answering one.
 *
 * `resolution` is mandatory in both directions. A refusal without a stated basis is not a lawful
 * response to a data subject request, and a completion without a note leaves the patient unable to
 * tell what was actually changed on their record.
 */
export const DataRequestResolveSchema = z.object({
  status: z.enum(['completed', 'refused']),
  resolution: z.string().min(1).max(DATA_REQUEST_DETAIL_MAX),
});

export type DataRequestResolveType = z.infer<typeof DataRequestResolveSchema>;
