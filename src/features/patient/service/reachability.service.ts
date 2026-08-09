import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { isEmailSuppressed } from '@/features/notifications/service/email-delivery.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientReachability } from '@/features/patient/types/patient.types';
import { ServiceResult } from '@/shared/types/common';

/**
 * Can this patient be reached at all?
 *
 * A reminder is only worth generating if there is somewhere for it to go. Six of thirteen
 * patients in production had neither an email address nor a push subscription, so the sweep was
 * faithfully creating, sending and retiring reminders for people it had no way to contact — and
 * reporting them as handled, because from the dispatcher's side they were.
 *
 * Nothing here is a delivery failure. An address that bounced is a different problem with a
 * different fix; this is a contact detail that was never collected, which only the clinic can
 * put right and which nothing was telling them about.
 *
 * The two channels are independent on purpose. Push requires a browser permission prompt that
 * most people decline, so email is the channel that actually carries reminders — a patient with
 * an address and no push is perfectly reachable, and must not be flagged as a problem.
 */
export async function getPatientReachabilityService(
  patientId: string,
  clinicId: string
): Promise<ServiceResult<PatientReachability>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  // Trimmed: a field holding a space is not an address, and `''` is what an uncollected one holds.
  const hasAddress = (patient.email ?? '').trim().length > 0;
  const suppressed = isEmailSuppressed(patient);

  const subscriptions = await pushSubscriptionRepository.findActiveByPatient(patientId);
  const hasPush = subscriptions.length > 0;

  const canEmail = hasAddress && !suppressed;

  return {
    data: {
      hasEmail: hasAddress,
      emailSuppressed: suppressed,
      hasPush,
      isReachable: canEmail || hasPush,
      /*
        Named separately because the remedy differs. A missing address is collected; a suppressed
        one is a bounce or a complaint the clinic has to resolve with the patient before anything
        can be sent there again.
      */
      reason: reachabilityReason(hasAddress, suppressed, hasPush),
    },
    status: 200,
  };
}

function reachabilityReason(
  hasAddress: boolean,
  suppressed: boolean,
  hasPush: boolean
): PatientReachability['reason'] {
  if (hasPush || (hasAddress && !suppressed)) return '';
  if (suppressed) return 'EMAIL_SUPPRESSED';
  return 'NO_CONTACT_METHOD';
}
