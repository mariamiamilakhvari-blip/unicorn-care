import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { toEmailClinic } from '@/features/notifications/service/email-clinic.service';
import {
  button,
  escapeHtml,
  muted,
  paragraph,
  section,
  shell,
  toPlainText,
} from '@/features/notifications/service/email-layout.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { emailCopy } from '@/shared/const/email-copy.const';
import { ContactMethod, contactMethodLabel } from '@/shared/const/recovery.const';
import { DASHBOARD_ROUTE } from '@/shared/const/routes.const';
import { SITE_URL } from '@/shared/const/seo.const';
import { resendClient } from '@/shared/lib/resend-client';
import { resolveClinicLocale } from '@/shared/utils/patient-locale';

/**
 * Tells a clinic that one of its patients filed a symptom report.
 *
 * The report already sits in the dashboard queue; before this, nothing announced it, so a patient
 * saying "something doesn't feel right" waited until somebody happened to look.
 *
 * **What this is not.** It is a notification, not monitoring. The platform does not watch for
 * symptoms, does not assess them, and nothing escalates if this email goes unread — which the
 * email says in as many words. A clinic that came to treat it as a safety net would be relying on
 * something the Terms and the DPA both disclaim, and a patient in danger must call emergency
 * services rather than wait for a clinic to read their inbox.
 *
 * **Minimum necessary.** The patient's name and the guide item they tapped go in the email; the
 * free text they wrote about their own body does not. The name answers "who", the label answers
 * "how urgently should I look", and neither requires the most sensitive part of the report to
 * travel through a mail provider to a shared clinic inbox. The detail stays behind the login.
 *
 * Never throws and never blocks. Filing the report is the thing that must not fail: a report
 * stored but unannounced is recoverable by opening the dashboard, whereas a report rejected
 * because a mail provider was down is a patient told their message did not go through.
 */
/**
 * What the alert carries beyond the patient's name.
 *
 * A parameter object rather than a fourth and fifth positional string: the call already read as
 * two anonymous strings at the call site, and a contact method silently swapped with a severity
 * label is a mistake the compiler could not have caught.
 */
export type SymptomAlertDetails = {
  warningTitle: string;
  severityLabel: string;
  contactMethod: ContactMethod;
  /** Already resolved against the patient record by the caller. Empty means none is held. */
  contactPhone: string;
};

export async function sendSymptomAlertService(
  patientId: string,
  clinicId: string,
  details: SymptomAlertDetails
): Promise<boolean> {
  try {
    if (!resendClient.isConfigured()) return false;

    const clinic = await clinicRepository.findById(clinicId);
    if (!clinic) return false;

    const owner = await userRepository.findById(clinic.ownerId.toString());
    /*
      The clinic's own contact address first, the owner's login second. The contact address is the
      practice's shared inbox and the one somebody is expected to be watching; an owner may be on
      leave. A clinic with neither is told nothing, which is why the caller does not depend on it.
    */
    const to = clinic.email || owner?.email || '';
    if (!to) return false;

    const patient = await patientRepository.findById(patientId, clinicId);
    if (!patient) return false;

    const { warningTitle, severityLabel, contactMethod, contactPhone } = details;
    const locale = resolveClinicLocale(clinic);
    const copy = emailCopy(locale);
    /*
      In the clinic's language, not the patient's. Whoever opens this inbox is staff, and the
      constant is used rather than `useTranslations` because a background send has no UI locale.
    */
    const methodLabel = contactMethodLabel(locale, contactMethod);
    const numberLabel = contactPhone || copy.symptomContactNumberNone;
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    const queueUrl = `${SITE_URL}${DASHBOARD_ROUTE}`;
    const emailClinic = toEmailClinic(clinic, locale, clinic.timezone);

    const sections = [
      section('🩺', copy.symptomIntro, paragraph(escapeHtml(emailClinic.name))),
      section(
        '',
        copy.symptomPatient,
        [
          paragraph(`<strong>${escapeHtml(patientName)}</strong>`),
          warningTitle
            ? paragraph(`${escapeHtml(copy.symptomFlagged)}: ${escapeHtml(warningTitle)}`)
            : '',
          severityLabel ? paragraph(escapeHtml(severityLabel)) : '',
          /*
            Contact details, not clinical detail. The free text the patient wrote about their own
            body still stays behind the login — what travels is how to reach them, which is the
            one thing a clinician reading this on a phone cannot get anywhere else.
          */
          paragraph(`${escapeHtml(copy.symptomContactMethod)}: ${escapeHtml(methodLabel)}`),
          paragraph(`${escapeHtml(copy.symptomContactNumber)}: ${escapeHtml(numberLabel)}`),
          muted(copy.symptomDetailWithheld),
        ].join('')
      ),
      section('', copy.symptomOpenQueue, button(copy.symptomOpenQueue, queueUrl)),
      // Standing and last: the clinic reads this every time, and it must never read as an alarm.
      section('', '', muted(copy.symptomNotMonitored)),
    ].join('');

    const lines = [
      copy.symptomIntro,
      `${copy.symptomPatient}: ${patientName}`,
      warningTitle ? `${copy.symptomFlagged}: ${warningTitle}` : '',
      `${copy.symptomContactMethod}: ${methodLabel}`,
      `${copy.symptomContactNumber}: ${numberLabel}`,
      copy.symptomDetailWithheld,
      queueUrl,
      copy.symptomNotMonitored,
    ].filter(Boolean);

    const result = await resendClient.send({
      to,
      subject: `${copy.symptomSubject} — ${patientName}`,
      html: shell(copy.symptomHeadline, sections, emailClinic, copy),
      text: toPlainText(copy.symptomHeadline, lines, emailClinic, copy),
    });

    if (!result.ok) {
      console.error('[email] symptom alert failed', clinicId, result.statusCode, result.message);
      return false;
    }
    return true;
  } catch (caught) {
    console.error('[email] symptom alert threw', caught);
    return false;
  }
}
