/**
 * Recovery-guide enums, kept out of the schema files on purpose.
 *
 * Client components need these values (severity pickers, status labels). Importing them from a
 * `*.schema.ts` drags Mongoose — and the whole MongoDB driver — into the browser bundle. The
 * schemas import from here instead, so the single source of truth stays dependency-free.
 */
import { AppLocale } from '@/shared/types/roles';

export const WARNING_SEVERITIES = ['call_clinic', 'urgent', 'emergency'] as const;

export type WarningSeverity = (typeof WARNING_SEVERITIES)[number];

/**
 * Severity labels in the language of the *guide*, not the language of the screen.
 *
 * `useTranslations` can only render the active UI locale, and that is the wrong one here: a guide
 * carries its own `locale` and is edited by a clinician whose interface may be set to the other
 * language. Reading the labels from the UI messages put a Georgian severity next to an English
 * warning in the same row. `recovery.const.spec.ts` pins these to `messages/*.json` so the two
 * copies cannot drift.
 */
export const WARNING_SEVERITY_LABELS: Record<AppLocale, Record<WarningSeverity, string>> = {
  en: {
    call_clinic: 'Call your clinic',
    urgent: 'Contact your clinic today',
    emergency: 'Seek emergency care now',
  },
  ka: {
    call_clinic: 'დაურეკეთ კლინიკას',
    urgent: 'დაუკავშირდით კლინიკას დღესვე',
    emergency: 'დაუყოვნებლივ მიმართეთ გადაუდებელ დახმარებას',
  },
};

export function warningSeverityLabel(locale: AppLocale, severity: WarningSeverity): string {
  return WARNING_SEVERITY_LABELS[locale][severity];
}

/**
 * Narrows a severity read back out of the database. Mongoose types the enum as a plain string, and
 * a guide written before a severity was renamed would otherwise index the label table with a key
 * that is not there.
 */
export function isWarningSeverity(value: string): value is WarningSeverity {
  return (WARNING_SEVERITIES as readonly string[]).includes(value);
}

export const SYMPTOM_REPORT_STATUSES = ['needs_review', 'reviewed', 'dismissed'] as const;

export type SymptomReportStatus = (typeof SYMPTOM_REPORT_STATUSES)[number];
