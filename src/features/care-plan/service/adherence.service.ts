import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ReminderStatus } from '@/features/care-plan/schema/reminder-occurrence.schema';
import {
  AdherenceDayBucket,
  AdherenceTotals,
  ReminderDisplayStatus,
} from '@/features/care-plan/types/care-plan.types';
import { clock } from '@/shared/lib/clock';

/** PRD 03 §5 — counts by status over the plan window plus the trailing week bucketed by day. */
const ADHERENCE_DAYS = 7;

const EMPTY_TOTALS: AdherenceTotals = { pending: 0, sent: 0, done: 0, skipped: 0, missed: 0 };

/**
 * Folds the transient claim state into `pending`. A row sits in `sending` only while a dispatch
 * run holds it, and from the patient's side nothing has happened yet.
 */
function toDisplayStatus(status: ReminderStatus): ReminderDisplayStatus {
  return status === 'sending' ? 'pending' : status;
}

export async function sumTotals(plans: CarePlanDocument[], clinicId: string): Promise<AdherenceTotals> {
  const totals: AdherenceTotals = { ...EMPTY_TOTALS };

  for (const plan of plans) {
    const counts = await reminderOccurrenceRepository.countByStatusForPlan(
      plan._id.toString(),
      clinicId
    );
    counts.forEach(entry => {
      totals[toDisplayStatus(entry._id)] += entry.count;
    });
  }

  return totals;
}

/**
 * Buckets are clinic-local calendar days: `eachDayInZone` returns the UTC instant of local midnight
 * for each of the last seven days plus tomorrow, which doubles as the exclusive upper bound.
 */
export async function buildDayBuckets(patientId: string, timezone: string): Promise<AdherenceDayBucket[]> {
  const now = clock.now();
  const edges = clock.eachDayInZone(
    clock.addDays(now, -(ADHERENCE_DAYS - 1)),
    clock.addDays(now, 1),
    timezone
  );
  const starts = edges.slice(0, ADHERENCE_DAYS);
  const end = edges[edges.length - 1];

  const occurrences = await reminderOccurrenceRepository.findByPatientAndRange(
    patientId,
    starts[0],
    end
  );

  const buckets = starts.map(start => emptyBucket(start));
  occurrences.forEach(occurrence => {
    const index = bucketIndexFor(starts, occurrence.dueAt);
    if (index < 0) return;
    buckets[index][toDisplayStatus(occurrence.status)] += 1;
    buckets[index].total += 1;
  });

  return buckets;
}

function emptyBucket(start: Date): AdherenceDayBucket {
  return { date: start.toISOString(), total: 0, ...EMPTY_TOTALS };
}

/** Index of the last day-start at or before `dueAt`, or -1 when the row predates the window. */
function bucketIndexFor(starts: Date[], dueAt: Date): number {
  let index = -1;
  starts.forEach((start, position) => {
    if (start.getTime() <= dueAt.getTime()) index = position;
  });
  return index;
}
