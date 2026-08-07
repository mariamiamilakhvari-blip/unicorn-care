import {
  getClinicAnalyticsService,
  quarterRange,
} from '@/features/analytics/service/analytics.service';
import { buildReportEmail } from '@/features/analytics/service/report-email.service';
import { SendReportType } from '@/features/analytics/validations/analytics.validation';
import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { resendClient } from '@/shared/lib/resend-client';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';

export type ReportSendResult = {
  sent: true;
  to: string;
};

/**
 * Sends one clinic its quarterly summary.
 *
 * The address is the clinic's own contact email if it has set one, falling back to the owner's
 * login. That order matters: the contact address is the practice's shared inbox and the one the
 * BAA promises to reach them at, while the owner's login is a person who may have left. Falling
 * back rather than requiring either means a clinic that filled in neither is told so, instead of
 * the send failing silently somewhere in a queue.
 *
 * The report is written in the clinic's language, not the admin's. It is the clinic's document.
 */
export async function sendQuarterlyReportService(
  input: SendReportType
): Promise<ServiceResult<ReportSendResult>> {
  const clinic = await clinicRepository.findById(input.clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const range = quarterRange(input.year, input.quarter);
  const { data, status } = await getClinicAnalyticsService(input.clinicId, range);
  // Narrowed rather than forwarded: the analytics failure shape is not this service's result type.
  if (status !== 200 || 'error' in data) {
    return { data: { error: 'ANALYTICS_FAILED' }, status: 500 };
  }

  const owner = await userRepository.findById(clinic.ownerId.toString());
  const to = clinic.email || owner?.email || '';
  if (!to) return { data: { error: 'NO_RECIPIENT' }, status: 422 };

  const email = buildReportEmail(
    data,
    {
      name: clinic.name,
      addressLine: clinic.addressLine ?? '',
      phone: clinic.phone ?? '',
      email: clinic.email ?? '',
      timezone: clinic.timezone,
    },
    {
      firstName: owner?.name ?? clinic.name,
      lastName: '',
      email: to,
      locale: (clinic.locale ?? 'ka') as AppLocale,
    }
  );

  const result = await resendClient.send({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!result.ok) {
    console.error('[report] send failed', input.clinicId, result.statusCode, result.message);
    return { data: { error: 'SEND_FAILED' }, status: 502 };
  }

  return { data: { sent: true, to }, status: 200 };
}
