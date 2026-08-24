import { Types } from 'mongoose';

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { RecoveryLogDocument } from '@/features/recovery-log/schema/recovery-log.schema';
import { RecoveryLogView, RecoveryTrendView } from '@/features/recovery-log/types/recovery-log.types';
import { CreateRecoveryLogType } from '@/features/recovery-log/validations/recovery-log.validation';
import { MoodLevel, SwellingLevel } from '@/shared/const/recovery-log.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

function toView(log: RecoveryLogDocument): RecoveryLogView {
  return {
    id: log._id.toString(),
    dayIndex: log.dayIndex,
    loggedAt: log.loggedAt.toISOString(),
    painLevel: log.painLevel,
    swelling: log.swelling as SwellingLevel,
    mood: (log.mood ?? null) as MoodLevel | null,
    note: log.note ?? '',
    photoIds: (log.photoIds ?? []).map(id => id.toString()),
  };
}

/**
 * Which day of recovery this is, in the clinic's timezone.
 *
 * Zone-local rather than a UTC subtraction: "day 3" is a calendar fact about where the patient
 * is, and a patient logging at 23:00 Tbilisi time is on the day they think they are, not the
 * next one.
 */
function dayIndexFor(plan: CarePlanDocument, timezone: string, now: Date): number {
  return Math.max(0, clock.daysBetweenInZone(plan.startsAt, now, timezone));
}

async function activePlanFor(patientId: string, clinicId: string) {
  const plans = await carePlanRepository.findActiveByPatient(patientId, clinicId);
  return plans[0] ?? null;
}

/**
 * Files one point on the recovery curve.
 *
 * The entry carries pain, swelling and mood. A note and photographs are no longer collected from
 * the patient, so neither is written here — an entry filed before they were dropped keeps both,
 * because a resubmit updates the readings and leaves those columns untouched rather than blanking
 * what the patient already told the clinic.
 *
 * Re-submitting the same day replaces the entry rather than adding a second. A patient who
 * reports pain, then remembers the swelling got worse, is correcting one reading — two rows for
 * one day would put a vertical line in the chart and make the day's real value ambiguous. The
 * unique index on `(carePlanId, dayIndex)` is the guarantee; this is the readable path.
 */
export async function createRecoveryLogService(
  patientId: string,
  clinicId: string,
  input: CreateRecoveryLogType
): Promise<ServiceResult<RecoveryLogView>> {
  const plan = await activePlanFor(patientId, clinicId);
  if (!plan) return { data: { error: 'NO_ACTIVE_PLAN' }, status: 409 };

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const now = clock.now();
  const dayIndex = dayIndexFor(plan, clinic.timezone, now);

  const existing = await recoveryLogRepository.findByPlanAndDay(plan._id.toString(), dayIndex);

  if (existing) {
    await recoveryLogRepository.updateById(existing._id.toString(), {
      loggedAt: now,
      painLevel: input.painLevel,
      swelling: input.swelling,
      mood: input.mood ?? null,
    });

    const updated = await recoveryLogRepository.findById(existing._id.toString());
    if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };
    return { data: toView(updated), status: 200 };
  }

  const id = await recoveryLogRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: new Types.ObjectId(clinicId),
    carePlanId: plan._id,
    loggedAt: now,
    dayIndex,
    painLevel: input.painLevel,
    swelling: input.swelling,
    mood: input.mood ?? null,
    note: '',
    photoIds: [],
  });

  const created = await recoveryLogRepository.findById(id);
  if (!created) return { data: { error: 'LOG_CREATE_FAILED' }, status: 500 };

  return { data: toView(created), status: 201 };
}

/** The patient's own history, so the portal can show what they already reported today. */
export async function listOwnRecoveryLogsService(
  patientId: string,
  clinicId: string
): Promise<ServiceResult<{ items: RecoveryLogView[]; todayIndex: number }>> {
  const plan = await activePlanFor(patientId, clinicId);
  const clinic = await clinicRepository.findById(clinicId);

  const logs = await recoveryLogRepository.findByPatient(patientId, clinicId);
  const todayIndex = plan && clinic ? dayIndexFor(plan, clinic.timezone, clock.now()) : -1;

  return { data: { items: logs.map(toView), todayIndex }, status: 200 };
}

/**
 * The clinic's view: the curve, not the individual readings.
 *
 * Returned as the plotted series plus the checkup days to mark on it. The shape over time is the
 * clinically useful signal — a single pain score says nothing, and the same score means opposite
 * things depending on which way the line was already heading.
 *
 * Nothing here is scored, flagged or escalated. This is what a patient said about their own
 * recovery, and turning it into an alert would make it triage, which it is not.
 */
export async function getRecoveryTrendService(
  patientId: string,
  clinicId: string
): Promise<ServiceResult<RecoveryTrendView>> {
  const logs = await recoveryLogRepository.findByPatient(patientId, clinicId);
  const plans = await carePlanRepository.findActiveByPatient(patientId, clinicId);
  const plan = plans[0] ?? null;
  const clinic = await clinicRepository.findById(clinicId);

  const checkupDays =
    plan && clinic
      ? plan.checkups.map(checkup =>
        clock.daysBetweenInZone(plan.startsAt, checkup.scheduledAt, clinic.timezone)
      )
      : [];

  return {
    data: {
      points: logs.map(toView),
      checkupDays: checkupDays.filter(day => day >= 0).sort((left, right) => left - right),
    },
    status: 200,
  };
}
