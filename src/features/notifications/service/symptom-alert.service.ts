import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
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
import { DASHBOARD_ROUTE } from '@/shared/const/routes.const';
import { SITE_URL } from '@/shared/const/seo.const';
import { resendClient } from '@/shared/lib/resend-client';
import { AppLocale } from '@/shared/types/roles';

/**
 * Tells a clinic that one of its patients filed a symptom report.
 *
 * The report already sits in the dashboard queue; before this, nothing announced it, so a patient
 * saying "something doesn't feel right" waited until somebody happened to look.
 *
 * **What this is not.** It is a notification, not monitoring. The platform does not watch for
 * symptoms, does not assess them, and nothing escalates if this email goes unread — which the
 * email says in as many words. A clinic that came to treat it as a safety net would be relying on
 * something the Terms and the BAA both disclaim, and a patient in danger must call emergency
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
export async function sendSymptomAlertService(
  patientId: string,
  clinicId: string,
  warningTitle: string,
  severityLabel: string
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

    const copy = emailCopy((clinic.locale ?? 'ka') as AppLocale);
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    const queueUrl = `${SITE_URL}${DASHBOARD_ROUTE}`;
    const emailClinic = {
      name: clinic.name,
      addressLine: clinic.addressLine ?? '',
      phone: clinic.phone ?? '',
      email: clinic.email ?? '',
      timezone: clinic.timezone,
    };

    const sections = [
      section('🩺', copy.symptomIntro, paragraph(escapeHtml(clinic.name))),
      section(
        '',
        copy.symptomPatient,
        [
          paragraph(`<strong>${escapeHtml(patientName)}</strong>`),
          warningTitle
            ? paragraph(`${escapeHtml(copy.symptomFlagged)}: ${escapeHtml(warningTitle)}`)
            : '',
          severityLabel ? paragraph(escapeHtml(severityLabel)) : '',
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
