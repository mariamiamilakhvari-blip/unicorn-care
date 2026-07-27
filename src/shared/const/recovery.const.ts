/**
 * Recovery-guide enums, kept out of the schema files on purpose.
 *
 * Client components need these values (severity pickers, status labels). Importing them from a
 * `*.schema.ts` drags Mongoose — and the whole MongoDB driver — into the browser bundle. The
 * schemas import from here instead, so the single source of truth stays dependency-free.
 */
export const WARNING_SEVERITIES = ['call_clinic', 'urgent', 'emergency'] as const;

export type WarningSeverity = (typeof WARNING_SEVERITIES)[number];

export const SYMPTOM_REPORT_STATUSES = ['needs_review', 'reviewed', 'dismissed'] as const;

export type SymptomReportStatus = (typeof SYMPTOM_REPORT_STATUSES)[number];
