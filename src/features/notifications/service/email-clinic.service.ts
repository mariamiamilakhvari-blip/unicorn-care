import { EmailClinic } from '@/features/notifications/types/email.types';
import { AppLocale } from '@/shared/types/roles';

/**
 * Builds the clinic footer block one email carries, in the language that email is written in.
 *
 * Pure, and deliberately in a module of its own rather than beside the other document-to-input
 * mappers in `email-input.service.ts`. That file reaches for the patient, procedure and portal-link
 * repositories, and `portal-link.service.ts` is one of the callers here — importing it from there
 * would close an import cycle. Nothing in this file loads anything.
 */

/**
 * The clinic's own details, as wide as every caller needs and no wider.
 *
 * A structural type rather than `ClinicDocument`: one caller has no clinic at all (a portal link
 * requested for a patient whose clinic row has since gone), the Mongoose inferred type makes every
 * defaulted field nullable anyway, and a plain shape is what lets this be tested without a
 * database — the same reason the email builders themselves take plain data.
 */
export type LocalisableClinic = {
  name: string;
  nameEn?: string | null;
  addressLine?: string | null;
  addressLineEn?: string | null;
  phone?: string | null;
  email?: string | null;
};

/**
 * The English text where there is one and the email is in English; the original otherwise.
 *
 * Trimmed before the emptiness test, because a field a clinic opened, spaced and abandoned holds
 * `' '` — which is truthy, and would print a footer with a blank where the clinic's name goes. The
 * fallback is to the Georgian original rather than to nothing: a patient who cannot read
 * "გაგუას კლინიკა" still learns which clinic wrote to them, and an empty line does not.
 */
function inLocale(original: string, english: string, locale: AppLocale): string {
  if (locale !== 'en') return original;
  return english.trim() || original;
}

/**
 * `timezone` is a required argument rather than read off the clinic, and that is the point: the
 * zone an email prints its times in is a per-email decision this function must not make. A
 * reminder uses the patient's own zone — printing the clinic's is what told a patient recovering
 * abroad to take a 09:30 tablet at 07:30 — while a report to the clinic uses the clinic's. Passing
 * it in forces each caller to say which it means.
 */
export function toEmailClinic(
  clinic: LocalisableClinic | null | undefined,
  locale: AppLocale,
  timezone: string
): EmailClinic {
  return {
    name: inLocale(clinic?.name ?? '', clinic?.nameEn ?? '', locale),
    addressLine: inLocale(clinic?.addressLine ?? '', clinic?.addressLineEn ?? '', locale),
    /*
      Not localised, and not an oversight. A phone number is digits, and an address the platform
      writes to is a mailbox — neither has a Georgian and an English form, and giving each a second
      field would be two more boxes on the settings form that no clinic could fill in differently.
    */
    phone: clinic?.phone ?? '',
    email: clinic?.email ?? '',
    timezone,
  };
}
