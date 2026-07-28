import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { SubscriptionView } from '@/features/clinic/types/clinic.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { findPlan, PlanKey } from '@/shared/const/plan.const';
import { SubscriptionStatus, WRITE_ALLOWED_STATUSES } from '@/shared/const/subscription.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

/** One read covers a clinic's roster; the limits are far below this. */
const ROSTER_LIMIT = 5000;

/**
 * Resolves the *effective* status.
 *
 * A trial does not expire because a scheduled job noticed — it expires because the date passed.
 * Deriving it on read means a clinic cannot keep trial access just because no cron ran, and there
 * is no background job to get out of step with reality.
 */
export function resolveStatus(clinic: ClinicDocument, now: Date): SubscriptionStatus {
  /*
    Clinics created before subscriptions existed have no `subscriptionStatus` — Mongoose defaults
    apply on insert, not to rows already in the collection. Reading the field raw locked every one
    of them out of writing. Missing means "grandfathered", which resolves to a trial with no end
    date rather than to a broken, falsy status.
  */
  const status = clinic.subscriptionStatus ?? 'trialing';

  if (status !== 'trialing') return status;
  if (!clinic.trialEndsAt) return 'trialing';
  return clinic.trialEndsAt.getTime() > now.getTime() ? 'trialing' : 'expired';
}

/** Active patients only — an archived record is history, not a seat being occupied. */
async function countActivePatients(clinicId: string): Promise<number> {
  const { items } = await patientRepository.findAllByClinic(clinicId, 1, ROSTER_LIMIT);
  return items.filter(patient => !patient.isArchived).length;
}

export async function getSubscriptionService(
  clinicId: string
): Promise<ServiceResult<SubscriptionView>> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const now = clock.now();
  const status = resolveStatus(clinic, now);
  const plan = findPlan((clinic.plan ?? 'trial') as PlanKey);
  const activePatients = await countActivePatients(clinicId);

  const trialDaysLeft = clinic.trialEndsAt
    ? Math.max(0, Math.ceil((clinic.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  return {
    data: {
      plan: plan.key,
      status,
      patientLimit: plan.patientLimit,
      activePatients,
      // Unlimited plans are never "at the limit", so the flag stays false rather than dividing.
      isAtPatientLimit: plan.patientLimit !== null && activePatients >= plan.patientLimit,
      canWrite: WRITE_ALLOWED_STATUSES.includes(status),
      trialEndsAt: clinic.trialEndsAt ? clinic.trialEndsAt.toISOString() : null,
      trialDaysLeft: status === 'trialing' ? trialDaysLeft : null,
      renewsAt: clinic.planRenewsAt ? clinic.planRenewsAt.toISOString() : null,
    },
    status: 200,
  };
}

export type SeatCheck = { ok: true } | { ok: false; reason: 'SUBSCRIPTION_INACTIVE' | 'PATIENT_LIMIT_REACHED' };

/**
 * Gate for adding another patient.
 *
 * Checked at the service layer rather than in the route so every caller is covered, and returns a
 * reason rather than a boolean so the UI can say which wall was hit — "your trial ended" and
 * "you are out of seats" need different responses from the clinic.
 */
export async function checkPatientSeat(clinicId: string): Promise<SeatCheck> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { ok: false, reason: 'SUBSCRIPTION_INACTIVE' };

  const status = resolveStatus(clinic, clock.now());
  if (!WRITE_ALLOWED_STATUSES.includes(status)) {
    return { ok: false, reason: 'SUBSCRIPTION_INACTIVE' };
  }

  const plan = findPlan((clinic.plan ?? 'trial') as PlanKey);
  if (plan.patientLimit === null) return { ok: true };

  const activePatients = await countActivePatients(clinicId);
  if (activePatients >= plan.patientLimit) {
    return { ok: false, reason: 'PATIENT_LIMIT_REACHED' };
  }

  return { ok: true };
}

/**
 * Moves a clinic onto a plan.
 *
 * No payment is taken here — see the billing note in the README. This is the seam a payment
 * provider's webhook would call once a charge succeeds, so nothing downstream has to change when
 * one is added.
 */
export async function setPlanService(
  clinicId: string,
  plan: PlanKey
): Promise<ServiceResult<SubscriptionView>> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const isTrial = plan === 'trial';
  await clinicRepository.updateById(clinicId, {
    plan,
    subscriptionStatus: isTrial ? 'trialing' : 'active',
    planRenewsAt: isTrial ? null : clock.addDays(clock.now(), 365),
  });

  return getSubscriptionService(clinicId);
}
