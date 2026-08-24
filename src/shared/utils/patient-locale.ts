import { AppLocale } from '@/shared/types/roles';

/** What a record falls back to when it names no language the product speaks. */
export const DEFAULT_LOCALE: AppLocale = 'ka';

const SUPPORTED: readonly AppLocale[] = ['ka', 'en'];

function asAppLocale(value: unknown): AppLocale | null {
  return SUPPORTED.find(locale => locale === value) ?? null;
}

/**
 * The language one patient is written to in.
 *
 * The patient's own choice wins, and the clinic's is the fallback for a record that predates the
 * field or never carried one. That order is the point: a clinic operating in Georgian may still
 * treat somebody who asked for English, and the person reading the email is the one whose
 * preference decides. Changing the *clinic* default therefore does not move a patient who already
 * has one — their record has to be edited, which is the correct place for that decision to live.
 *
 * **Validated rather than cast.** Six call sites used to write `(patient.locale ?? clinic.locale)
 * as AppLocale`, which asserts a shape nobody had checked: the value comes out of Mongo, and a row
 * holding `'EN'`, `'ka-GE'`, `'ru'` or an empty string satisfies the cast and none of the readers.
 * The email copy happened to survive it — `emailCopy` treats anything that is not `'en'` as
 * Georgian — but the recovery-guide lookup does not, and `findForClinic(clinicId, type, 'ka-GE')`
 * matches no row at all, so the patient silently loses the guidance rather than reading it in the
 * wrong language. Anything unrecognised now lands on the default instead of travelling onward.
 */
export function resolvePatientLocale(
  patient: { locale?: string | null } | null | undefined,
  clinic: { locale?: string | null } | null | undefined
): AppLocale {
  return asAppLocale(patient?.locale) ?? asAppLocale(clinic?.locale) ?? DEFAULT_LOCALE;
}

/** The clinic's own language, for the messages that go to staff rather than to a patient. */
export function resolveClinicLocale(
  clinic: { locale?: string | null } | null | undefined
): AppLocale {
  return asAppLocale(clinic?.locale) ?? DEFAULT_LOCALE;
}
