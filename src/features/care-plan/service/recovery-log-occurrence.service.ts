import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { OccurrenceDraft, OccurrenceTranslator } from '@/features/care-plan/types/care-plan.types';
import {
  RECOVERY_LOG_CADENCE,
  RECOVERY_LOG_PROMPT_TIME,
} from '@/shared/const/recovery-log.const';
import { clock } from '@/shared/lib/clock';

type LogDraftContext = {
  plan: CarePlanDocument;
  timezone: string;
  horizonEnd: Date;
  generatedAt: Date;
  t: OccurrenceTranslator;
};

/**
 * Which days of recovery get a prompt, given the decreasing cadence.
 *
 * Walks forward rather than filtering a range, so each band's interval is measured from the last
 * prompt actually issued and not from day zero. Filtering on `day % everyDays` would double up at
 * every band boundary — day 28 satisfies both a 3-day and a 7-day rule.
 *
 * Day 0 is skipped. That is the day of the operation, and a patient still on the ward is not in a
 * position to report a recovery trend.
 */
export function recoveryLogDays(lastDay: number): number[] {
  const days: number[] = [];

  let day = 1;
  while (day <= lastDay) {
    days.push(day);
    const band = RECOVERY_LOG_CADENCE.find(entry => day < entry.untilDay);
    day += band ? band.everyDays : 1;
  }

  return days;
}

/**
 * The recurring "how is recovery going?" prompt (PRD 06 §3).
 *
 * A separate occurrence kind rather than a rehabilitation task, because it is not something the
 * clinic prescribed and not something the patient does — it asks for a reading. It carries no
 * clinical content in `body` for the same reason every other occurrence does not: a lock-screen
 * preview is readable by whoever is holding the phone.
 *
 * `sourceItemId` is the plan's own id. Every other kind points at the subdocument that produced
 * it, and this one has no subdocument: the prompt comes from the plan existing, not from anything
 * inside it.
 */
export function buildRecoveryLogOccurrences(context: LogDraftContext): OccurrenceDraft[] {
  const { plan, timezone, horizonEnd, generatedAt, t } = context;

  // Opt-in per plan. A plan that predates the feature has no field, and asks nothing.
  if (!plan.recoveryLogEnabled) return [];

  const lastDay = clock.daysBetweenInZone(plan.startsAt, plan.rehabEndsAt, timezone);
  if (lastDay < 1) return [];

  return recoveryLogDays(lastDay).flatMap(dayIndex => {
    // Same rule as the guide notices: add days in UTC where the arithmetic is exact, then anchor
    // that calendar date to local midnight. See `civilDateInZone`.
    const day = clock.civilDateInZone(clock.addDays(plan.startsAt, dayIndex), timezone);
    const dueAt = clock.zonedTimeToUtc(day, RECOVERY_LOG_PROMPT_TIME, timezone);
    if (dueAt.getTime() > horizonEnd.getTime()) return [];

    return [
      {
        carePlanId: plan._id,
        patientId: plan.patientId,
        clinicId: plan.clinicId,
        kind: 'recovery_log' as const,
        sourceItemId: plan._id,
        dueAt,
        // Prompted at the moment it is for, so the two are the same instant.
        scheduledAt: dueAt,
        title: t('recoveryCheckIn'),
        body: '',
        intensity: null,
        status: 'pending' as const,
        sentAt: null,
        completedAt: null,
        createdAt: generatedAt,
        updatedAt: generatedAt,
      },
    ];
  });
}
