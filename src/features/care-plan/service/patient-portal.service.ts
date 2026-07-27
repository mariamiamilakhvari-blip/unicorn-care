import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import {
  PortalDay,
  PortalOccurrence,
  PortalPlanView,
} from '@/features/care-plan/types/portal.types';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

/** How far the portal looks either side of today. Bounded on purpose — see `PortalDay`. */
const DAYS_BEHIND = 1;
const DAYS_AHEAD = 6;

/** How far ahead to look for the next appointment, independent of the day list above. */
const CHECKUP_LOOKAHEAD_DAYS = 180;

function toPortalOccurrence(occurrence: ReminderOccurrenceDocument): PortalOccurrence {
  return {
    id: occurrence._id.toString(),
    kind: occurrence.kind,
    title: occurrence.title,
    body: occurrence.body ?? '',
    intensity: occurrence.intensity ?? null,
    dueAt: occurrence.dueAt.toISOString(),
    status: occurrence.status,
  };
}

/** Groups by UTC calendar day; the client renders each `date` in the patient's own zone. */
function groupByDay(occurrences: PortalOccurrence[]): PortalDay[] {
  const byDate = new Map<string, PortalOccurrence[]>();

  for (const occurrence of occurrences) {
    const date = occurrence.dueAt.slice(0, 10);
    const bucket = byDate.get(date) ?? [];
    bucket.push(occurrence);
    byDate.set(date, bucket);
  }

  return [...byDate.entries()]
    .map(([date, items]) => ({ date, occurrences: items }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function findNextCheckup(occurrences: PortalOccurrence[], now: Date): PortalOccurrence | null {
  const upcoming = occurrences.filter(
    item => item.kind === 'checkup' && new Date(item.dueAt).getTime() >= now.getTime()
  );
  return upcoming[0] ?? null;
}

/**
 * The patient portal's only read. `patientId` comes from `patientGuard`, never from a query
 * param — the portal exposes exactly one patient's data (PRD 02 §B).
 */
export async function getPortalPlanService(
  patientId: string,
  clinicId: string
): Promise<ServiceResult<PortalPlanView>> {
  const now = clock.now();
  const from = clock.addDays(now, -DAYS_BEHIND);
  const to = clock.addDays(now, DAYS_AHEAD);

  const documents = await reminderOccurrenceRepository.findByPatientAndRange(patientId, from, to);
  const occurrences = documents.map(toPortalOccurrence);

  /*
    The next checkup is looked up over a much longer horizon than the day list.
    A follow-up three weeks out is exactly what a recovering patient wants to see, and bounding it
    to the same short window meant it simply never appeared.
  */
  const checkupDocuments = await reminderOccurrenceRepository.findByPatientAndRange(
    patientId,
    now,
    clock.addDays(now, CHECKUP_LOOKAHEAD_DAYS)
  );

  const plans = await carePlanRepository.findActiveByPatient(patientId, clinicId);
  const rehabEndsAt = plans[0]?.rehabEndsAt ? plans[0].rehabEndsAt.toISOString() : null;

  return {
    data: {
      todayIso: now.toISOString(),
      days: groupByDay(occurrences),
      nextCheckup: findNextCheckup(checkupDocuments.map(toPortalOccurrence), now),
      rehabEndsAt,
    },
    status: 200,
  };
}

/**
 * Marks a dose or task done/skipped. An occurrence belonging to another patient returns 404, not
 * 403 — a 403 would confirm the id exists (PRD 03 §4).
 */
export async function completeOccurrenceService(
  patientId: string,
  occurrenceId: string,
  outcome: 'done' | 'skipped'
): Promise<ServiceResult<PortalOccurrence>> {
  const occurrence = await reminderOccurrenceRepository.findByIdForPatient(occurrenceId, patientId);
  if (!occurrence) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const completedAt = outcome === 'done' ? clock.now() : null;
  await reminderOccurrenceRepository.updateStatus(occurrenceId, {
    status: outcome,
    completedAt,
  });

  return {
    data: { ...toPortalOccurrence(occurrence), status: outcome },
    status: 200,
  };
}
