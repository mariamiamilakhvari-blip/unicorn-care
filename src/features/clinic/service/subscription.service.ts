import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { SubscriptionView } from '@/features/clinic/types/clinic.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { findPlan, PlanKey } from '@/shared/const/plan.const';
import {
  DISPATCH_GRACE_DAYS,
  GRACE_WARNING_AFTER_DAYS,
  SubscriptionStatus,
  WRITE_ALLOWED_STATUSES,
} from '@/shared/const/subscription.const';
import { clock } from '@/shared/lib/clock';
import { dodoClient } from '@/shared/lib/dodo-client';
import { ServiceResult } from '@/shared/types/common';

/** One read covers a clinic's roster; the limits are far below this. */
const ROSTER_LIMIT = 5000;

/**
 * True when the subscription is cancelled but the period the clinic already paid for has not run
 * out yet — the "cancels on 3 March" state, not the "cancelled" state.
 *
 * Read off the *stored* status rather than the resolved one, because the resolved status is
 * precisely what this decides: while a cancellation is only scheduled, the clinic still reads as
 * `active`.
 *
 * A cancelled trial is never scheduled. It has no `planRenewsAt`, and nothing has been paid for
 * that would be unfair to take back — switching a trial off means switching it off.
 */
export function isCancellationScheduled(clinic: ClinicDocument, now: Date): boolean {
  return (
    clinic.subscriptionStatus === 'cancelled' &&
    Boolean(clinic.planRenewsAt) &&
    (clinic.planRenewsAt as Date).getTime() > now.getTime()
  );
}

/**
 * Resolves the *effective* status.
 *
 * A trial does not expire because a scheduled job noticed — it expires because the date passed.
 * Deriving it on read means a clinic cannot keep trial access just because no cron ran, and there
 * is no background job to get out of step with reality. Cancellation works the same way: the
 * status flips when the paid period ends, not when someone clicked the button.
 */
export function resolveStatus(clinic: ClinicDocument, now: Date): SubscriptionStatus {
  /*
    Clinics created before subscriptions existed have no `subscriptionStatus` — Mongoose defaults
    apply on insert, not to rows already in the collection. Reading the field raw locked every one
    of them out of writing. Missing means "grandfathered", which resolves to a trial with no end
    date rather than to a broken, falsy status.
  */
  const status = clinic.subscriptionStatus ?? 'trialing';

  /*
    A cancellation does not take back the month already paid for. Until `planRenewsAt` passes the
    clinic is still active in every sense that matters — it can add patients, build plans and send
    reminders — and only then does the stored `cancelled` become the effective one.

    Checked before the branch below so it covers a cancellation from either direction: our own
    cancel endpoint, and a `subscription.cancelled` webhook fired when the owner cancels inside
    Dodo's portal. Without it, cancelling on the second of the month deleted twenty-eight days the
    clinic had already been charged for.
  */
  if (isCancellationScheduled(clinic, now)) return 'active';

  if (status !== 'trialing') return status;
  if (!clinic.trialEndsAt) return 'trialing';
  return clinic.trialEndsAt.getTime() > now.getTime() ? 'trialing' : 'expired';
}

const MS_PER_DAY = 86_400_000;

/**
 * The instant paid access ended, or `null` while the subscription is live.
 *
 * Two sources, because a lapse has two shapes. A trial ends on a date we already hold, so it needs
 * no timestamp of its own and cannot drift — `trialEndsAt` is both the expiry and the anchor. A
 * failed renewal or a cancellation has no such date, so `subscriptionEndedAt` is written when the
 * status changes and read back here.
 *
 * Trial first: a clinic can hold a stale `subscriptionEndedAt` from an earlier paid period and
 * still be trialing today, and the grace window has to be measured from the lapse that is actually
 * in force.
 */
export function lapsedAt(clinic: ClinicDocument, now: Date): Date | null {
  const status = resolveStatus(clinic, now);
  if (WRITE_ALLOWED_STATUSES.includes(status)) return null;

  // An expired trial: the anchor is the day the seven days ran out, to the minute.
  if ((clinic.subscriptionStatus ?? 'trialing') === 'trialing' && clinic.trialEndsAt) {
    return clinic.trialEndsAt;
  }

  const stamp = clinic.subscriptionEndedAt ?? null;
  const periodEnd = clinic.planRenewsAt ?? null;

  /*
    Access ended at the last moment the clinic was entitled to it, which is not always the moment
    the status changed. Someone who cancels on the 2nd keeps the month they paid for, so their
    fourteen days of reminders start when that month runs out — anchoring to the click would end
    their patients' reminders while they were still a paying customer. The same applies to a
    cancellation made inside Dodo's portal, where the webhook lands weeks before the period does.

    So: the later of the two, ignoring a period end still in the future (which means the
    cancellation is merely scheduled and this function has already returned `null` above).
  */
  if (periodEnd && periodEnd.getTime() <= now.getTime()) {
    return stamp && stamp.getTime() > periodEnd.getTime() ? stamp : periodEnd;
  }

  return stamp;
}

/** Where a clinic stands in the 14-day reminder window. All fields are `null` while it is live. */
export type GraceWindow = {
  /** When reminders stop. `null` while the subscription is live. */
  endsAt: Date | null;
  /** Whole days left, floored at 0. `null` while the subscription is live. */
  daysLeft: number | null;
  /** Lapsed, but reminders are still going out. */
  isActive: boolean;
  /** Inside the last four days — the point the clinic is warned rather than merely informed. */
  isWarning: boolean;
  /** Whether the sweep may still send for this clinic at all. */
  mayDispatch: boolean;
};

/**
 * Resolves the grace window from the clinic document.
 *
 * Pure and synchronous so the sweep, the API view and the tests all read the same rule from the
 * same place — a second copy of "is it more than fourteen days" somewhere else is how the banner
 * and the dispatcher end up disagreeing about whether a clinic is cut off.
 *
 * A lapsed clinic with no anchor at all — one that lapsed before the field existed — is treated as
 * a window that has already closed. Those clinics lapsed months ago; the alternative reading, an
 * unbounded grace period, is the exact loophole the ceiling exists to prevent.
 */
export function resolveGrace(clinic: ClinicDocument, now: Date): GraceWindow {
  const lapsed = lapsedAt(clinic, now);

  if (lapsed === null) {
    const live = WRITE_ALLOWED_STATUSES.includes(resolveStatus(clinic, now));
    // Live subscription: no window to be in. Lapsed with no anchor: the window is already gone.
    return {
      endsAt: null,
      daysLeft: null,
      isActive: false,
      isWarning: false,
      mayDispatch: live,
    };
  }

  const endsAt = new Date(lapsed.getTime() + DISPATCH_GRACE_DAYS * MS_PER_DAY);
  const isActive = now.getTime() < endsAt.getTime();
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / MS_PER_DAY));
  const dayOfGrace = (now.getTime() - lapsed.getTime()) / MS_PER_DAY;

  return {
    endsAt,
    daysLeft,
    isActive,
    isWarning: isActive && dayOfGrace >= GRACE_WARNING_AFTER_DAYS,
    mayDispatch: isActive,
  };
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
    ? Math.max(0, Math.ceil((clinic.trialEndsAt.getTime() - now.getTime()) / MS_PER_DAY))
    : null;

  const grace = resolveGrace(clinic, now);
  const cancelScheduled = isCancellationScheduled(clinic, now);

  return {
    data: {
      plan: plan.key,
      status,
      patientLimit: plan.patientLimit,
      activePatients,
      // Unlimited plans are never "at the limit", so the flag stays false rather than dividing.
      isAtPatientLimit: plan.patientLimit !== null && activePatients >= plan.patientLimit,
      canWrite: WRITE_ALLOWED_STATUSES.includes(status),
      /*
        A subscription can only be ended while it is still running. An expired trial and an
        already-cancelled plan have nothing left to switch off, and offering the button there
        reads as a second, different action rather than as a no-op.
      */
      // A pending cancellation resolves to `active`, so it has to be excluded explicitly or the
      // owner is offered a Cancel button for a subscription that is already cancelling.
      canCancel: (status === 'trialing' || status === 'active') && !cancelScheduled,
      cancelScheduled,
      /*
        The grace window, reported whether or not the clinic is in one, so the dashboard can say
        three different things: reminders are running normally, reminders are running on borrowed
        time and stop on a date, or reminders have stopped. Before this the UI could only say
        "inactive", which is the same word for a clinic whose patients are still being reminded
        and one whose patients are not.
      */
      remindersActive: grace.mayDispatch,
      isInGrace: grace.isActive,
      isGraceWarning: grace.isWarning,
      graceEndsAt: grace.endsAt ? grace.endsAt.toISOString() : null,
      graceDaysLeft: grace.daysLeft,
      trialEndsAt: clinic.trialEndsAt ? clinic.trialEndsAt.toISOString() : null,
      trialDaysLeft: status === 'trialing' ? trialDaysLeft : null,
      renewsAt: clinic.planRenewsAt ? clinic.planRenewsAt.toISOString() : null,
    },
    status: 200,
  };
}

/**
 * Whether a clinic may still create clinical records at all.
 *
 * The seat check answers "is there room for another patient"; this answers the question that comes
 * before it — is the subscription live. They are separate because a clinic on an expired trial is
 * not out of seats, and a clinic on Premium with a lapsed card is not over any limit: both are
 * blocked, for reasons that need different words on screen.
 *
 * Derived from `trialEndsAt` on every call, so a trial that ran out a minute ago is refused a
 * minute ago — there is no job that has to have run first.
 */
export async function canClinicWrite(clinicId: string): Promise<boolean> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return false;
  return WRITE_ALLOWED_STATUSES.includes(resolveStatus(clinic, clock.now()));
}

/**
 * Whether the sweep may still send this clinic's reminders.
 *
 * Deliberately a different question from `canClinicWrite`, and deliberately a longer answer.
 * Writing stops at the instant of expiry because a new patient or a new care plan is the clinic
 * buying more of the product. Sending does not, because the reminders already scheduled belong to
 * a patient who is mid-recovery and had no part in the billing. The 14-day ceiling is what keeps
 * that from becoming a way to run a year-long plan for free — see `DISPATCH_GRACE_DAYS`.
 *
 * Fails closed on a clinic that cannot be read: a reminder we cannot attribute to a live practice
 * is one we should not be sending on anyone's behalf.
 */
export async function canClinicDispatch(clinicId: string): Promise<boolean> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return false;
  return resolveGrace(clinic, clock.now()).mayDispatch;
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
 * Ends the clinic's own subscription, on their initiative.
 *
 * A trial that cannot be switched off is a trial the clinic has to wait out, and the only exit we
 * offered was deleting the account — which takes every patient record with it. This ends the
 * billing relationship and touches nothing clinical: the roster, the plans and the reminders that
 * were already generated all stay exactly where they are, and `plan` is left alone so the record
 * of what they were on survives the cancellation.
 *
 * The provider is cancelled first and a failure there aborts the whole thing, for the same reason
 * account deletion does it in that order: a clinic marked cancelled here while Dodo keeps charging
 * is the one outcome there is no way to notice from inside the app.
 *
 * A paid plan is cancelled *at the end of the period already paid for*, not on the spot. Cancelling
 * on the 2nd used to delete the twenty-eight days the clinic had just been charged for, which is
 * both wrong and the sort of thing that gets disputed with a card issuer. A trial has nothing paid
 * for and ends immediately.
 */
export async function cancelSubscriptionService(
  clinicId: string
): Promise<ServiceResult<SubscriptionView>> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const now = clock.now();

  // Already scheduled. Caught before the status check below, which reports a pending cancellation
  // as `active` by design and would otherwise let the owner cancel the same subscription twice.
  if (isCancellationScheduled(clinic, now)) {
    return { data: { error: 'ALREADY_CANCELLED' }, status: 409 };
  }

  const status = resolveStatus(clinic, now);
  // Nothing to end. Returned as a conflict rather than a silent success so a double submit does
  // not read as having cancelled something twice.
  if (status !== 'trialing' && status !== 'active') {
    return { data: { error: 'NOT_CANCELLABLE' }, status: 409 };
  }

  if (clinic.dodoSubscriptionId) {
    const cancelled = await dodoClient.cancelSubscription(clinic.dodoSubscriptionId);
    if (!cancelled.ok) {
      console.error('[subscription] cancel failed at provider', {
        clinicId,
        statusCode: cancelled.statusCode,
        message: cancelled.message,
      });
      return { data: { error: 'CANCEL_FAILED' }, status: 502 };
    }
  }

  /*
    `trialEndsAt` is deliberately kept. It is the record of the window the clinic was given, and
    clearing it would make a cancelled trial indistinguishable from one that never started — which
    matters the moment anyone asks whether a clinic left before or after their seven days.
  */
  /*
    `planRenewsAt` is kept, not cleared, and it changes meaning at this point: it stops being the
    next charge date and becomes the date access ends. `resolveStatus` reads it to keep the clinic
    active until then, so clearing it here would collapse the whole period-end grace back into an
    instant cut-off.

    Null on a trial, which has no paid period — a cancelled trial ends the moment it is cancelled.
  */
  const accessEndsAt = clinic.planRenewsAt ?? null;

  /*
    `subscriptionEndedAt` is the anchor the 14-day reminder grace window is measured from, and this
    is one of only two places a lapse gets a timestamp — the other is the webhook. Without it a
    self-cancelled clinic has no readable lapse date, and `resolveGrace` would treat their window
    as already closed: every patient mid-recovery would stop being reminded the moment the owner
    clicked cancel, which is precisely what the grace period exists to prevent.

    Stamped with the end of the paid period rather than with now, so the fourteen days start when
    access actually ends. Anchoring to the click would run the reminder window down while the
    clinic was still a paying customer, and a clinic cancelling on day two of an annual plan would
    find its patients unreachable eleven and a half months early.
  */
  await clinicRepository.updateById(clinicId, {
    subscriptionStatus: 'cancelled',
    planRenewsAt: accessEndsAt,
    subscriptionEndedAt: accessEndsAt ?? now,
  });

  return getSubscriptionService(clinicId);
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
