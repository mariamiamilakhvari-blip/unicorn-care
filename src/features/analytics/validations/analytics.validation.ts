import { z } from 'zod';

import { QUARTERS } from '@/shared/const/analytics.const';

const FIRST_YEAR = 2020;
const LAST_YEAR = 2100;

/**
 * A window, given either as a quarter or as two dates.
 *
 * Two shapes rather than one because they answer different questions: a quarter is what a report
 * is titled by, a custom range is what someone reaches for when the question does not fit the
 * calendar. Discriminated so neither has optional fields the other must ignore.
 */
export const AnalyticsRangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('quarter'),
    year: z.coerce.number().int().min(FIRST_YEAR).max(LAST_YEAR),
    quarter: z.coerce.number().int().refine(value => QUARTERS.some(q => q === value)),
  }),
  z.object({
    kind: z.literal('custom'),
    from: z.coerce.date(),
    to: z.coerce.date(),
  }),
]);

export type AnalyticsRangeInput = z.infer<typeof AnalyticsRangeSchema>;

/** `POST /api/admin/reports` — sends the quarterly summary for one clinic. */
export const SendReportSchema = z.object({
  clinicId: z.string().min(24).max(24),
  year: z.coerce.number().int().min(FIRST_YEAR).max(LAST_YEAR),
  quarter: z.coerce.number().int().refine(value => QUARTERS.some(q => q === value)),
});

export type SendReportType = z.infer<typeof SendReportSchema>;
