import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { OccurrenceDraft, OccurrenceTranslator } from '@/features/care-plan/types/care-plan.types';
import { clock } from '@/shared/lib/clock';

/** Clinic-local wall clock for a guide reminder. Morning, so it reads as part of that day. */
const GUIDE_REMINDER_TIME = '09:00';

/**
 * Only what the generator needs off a recovery guide, so this stays pure and does not depend on
 * the Mongoose document type. `_id` is the subdocument id, linking the row back to its sign.
 */
export type RecoveryGuideForOccurrences = {
  expected: { _id: OccurrenceDraft['sourceItemId']; title: string; fromDay: number }[];
};

type GuideDraftContext = {
  plan: CarePlanDocument;
  timezone: string;
  horizonEnd: Date;
  generatedAt: Date;
  t: OccurrenceTranslator;
};

/**
 * One reminder per expected sign, on the day of recovery that sign begins.
 *
 * The guide is authored in days since the operation, not in wall-clock times, so `fromDay` is
 * counted off `plan.startsAt` and then resolved to a clinic-local morning.
 *
 * Warning signs are deliberately never turned into reminders. They are the "call the clinic" half
 * of the guide, and pushing them on a schedule would tell a patient to worry on a date rather than
 * about a symptom they actually have — the guide stays reference material they read when something
 * feels wrong.
 */
export function buildGuideOccurrences(
  context: GuideDraftContext,
  guide: RecoveryGuideForOccurrences | null
): OccurrenceDraft[] {
  if (!guide) return [];

  return guide.expected.flatMap(sign => {
    /*
      Day arithmetic in UTC first, then reinterpreted in the plan's zone. `startsAt` is a stored
      civil date at UTC midnight, so adding days there is exact — UTC has no DST — and
      `civilDateInZone` then anchors the result to local midnight on that same calendar date.
      Reading the raw instant in the zone instead put day 0 on the evening before west of UTC, and
      every notice with it.
    */
    const day = clock.civilDateInZone(
      clock.addDays(context.plan.startsAt, sign.fromDay),
      context.timezone
    );
    const dueAt = clock.zonedTimeToUtc(day, GUIDE_REMINDER_TIME, context.timezone);
    if (dueAt.getTime() > context.horizonEnd.getTime()) return [];

    return [
      {
        carePlanId: context.plan._id,
        patientId: context.plan.patientId,
        clinicId: context.plan.clinicId,
        kind: 'guide' as const,
        sourceItemId: sign._id,
        dueAt,
        // A notice, not an appointment: it is sent at the time it is for, so there is no lead
        // and nothing to correct for.
        scheduledAt: dueAt,
        title: sign.title,
        body: context.t('expectedSign'),
        intensity: null,
        status: 'pending' as const,
        sentAt: null,
        completedAt: null,
        createdAt: context.generatedAt,
        updatedAt: context.generatedAt,
      },
    ];
  });
}
