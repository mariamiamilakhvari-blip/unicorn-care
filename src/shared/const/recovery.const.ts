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

/**
 * How a patient wants their clinic to come back to them about a concern.
 *
 * A preference, never a routing instruction. Nothing in the platform dials, messages or emails on
 * the strength of this — it is written on the report so the clinician reading the queue knows
 * which of the three to reach for, and a clinic that cannot honour it is free not to.
 *
 * `whatsapp` covers both WhatsApp and Viber, because a patient recovering abroad picks "the app",
 * not the vendor. The dashboard can only offer a one-click link for WhatsApp — Viber has no
 * equivalent web handoff that works from a desktop browser — so the number is always printed
 * beside it for a clinician who needs to open the other one by hand.
 */
export const CONTACT_METHODS = ['phone', 'whatsapp', 'email'] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number];

/**
 * What a patient gets if they never touch the selector.
 *
 * `phone` because it is what the queue already did: the report card has always carried a `tel:`
 * link and nothing else, so the default keeps every existing report and every patient who ignores
 * the field reading exactly as it did before.
 */
export const DEFAULT_CONTACT_METHOD: ContactMethod = 'phone';

/**
 * Contact-method labels in the language of the *clinic*, for the alert email.
 *
 * Same reason `WARNING_SEVERITY_LABELS` exists: `useTranslations` renders the active UI locale,
 * and an email composed on a background request has no UI locale to render. `recovery.const.spec`
 * pins these to `messages/*.json` so the mail and the dashboard cannot drift apart.
 */
export const CONTACT_METHOD_LABELS: Record<AppLocale, Record<ContactMethod, string>> = {
  en: {
    phone: 'Phone call',
    whatsapp: 'WhatsApp / Viber',
    email: 'Email',
  },
  ka: {
    phone: 'სატელეფონო ზარი',
    whatsapp: 'WhatsApp / Viber',
    email: 'ელფოსტა',
  },
};

export function contactMethodLabel(locale: AppLocale, method: ContactMethod): string {
  return CONTACT_METHOD_LABELS[locale][method];
}

/**
 * Narrows a contact method read back out of the database. Mongoose types the enum as a plain
 * string, and a report written before a method was renamed would otherwise index the label table
 * with a key that is not there.
 */
export function isContactMethod(value: string): value is ContactMethod {
  return (CONTACT_METHODS as readonly string[]).includes(value);
}
