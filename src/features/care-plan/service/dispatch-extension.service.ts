import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { buildOccurrences } from '@/features/care-plan/service/occurrence-generator.service';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { clock } from '@/shared/lib/clock';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Extend once the already-generated horizon has less than this much runway left (PRD 04 §7). */
const EXTENSION_TRIGGER_DAYS = 14;

/** Size of each rolling window, matching the 90-day generation cap in PRD 03 §3. */
const EXTENSION_WINDOW_DAYS = 90;

/** Upper bound for the "is anything generated past the trigger point?" probe. */
const HORIZON_PROBE_DAYS = 3650;

/**
 * True when the plan has no occurrence generated beyond the trigger point, i.e. the patient is
 * within `EXTENSION_TRIGGER_DAYS` of running out of reminders.
 */
async function needsExtension(plan: CarePlanDocument, now: Date): Promise<boolean> {
  const triggerAt = clock.addDays(now, EXTENSION_TRIGGER_DAYS);
  const upcoming = await reminderOccurrenceRepository.findByPatientAndRange(
    plan.patientId.toString(),
    triggerAt,
    clock.addDays(now, HORIZON_PROBE_DAYS)
  );
  const planId = plan._id.toString();
  return !upcoming.some(occurrence => occurrence.carePlanId.toString() === planId);
}

/**
 * Regenerate the plan over a horizon that reaches `EXTENSION_WINDOW_DAYS` past today.
 *
 * `buildOccurrences` is deterministic from `plan.startsAt`, so the safe way to add a window is
 * the same routine activation uses (PRD 03 §Activation): drop the *pending* rows and rebuild.
 * `sent` / `done` / `skipped` / `missed` history is never touched, so adherence data survives.
 */
async function extendPlan(plan: CarePlanDocument, now: Date): Promise<boolean> {
  const clinic = await clinicRepository.findById(plan.clinicId.toString());
  if (!clinic) return false;

  const elapsedDays = Math.max(
    0,
    Math.ceil((now.getTime() - plan.startsAt.getTime()) / MS_PER_DAY)
  );
  const horizonDays = elapsedDays + EXTENSION_WINDOW_DAYS;

  const drafts = buildOccurrences(plan, clinic.timezone, horizonDays);
  if (drafts.length === 0) return false;

  await reminderOccurrenceRepository.deletePendingByCarePlan(
    plan._id.toString(),
    plan.clinicId.toString()
  );
  await reminderOccurrenceRepository.insertMany(drafts);
  return true;
}

/**
 * Rolling extension step of the dispatch sweep (PRD 04 §"The sweep" step 7).
 *
 * Runs unscoped by clinic — the cron is the platform, authorised by `CRON_SECRET`, and has no
 * clinic session. Returns how many plans were rolled forward.
 */
export async function extendActivePlansService(now: Date): Promise<number> {
  const plans = await carePlanRepository.findActivePlansNeedingExtension(now);

  let extended = 0;
  for (const plan of plans) {
    const due = await needsExtension(plan, now);
    if (!due) continue;
    const rolled = await extendPlan(plan, now);
    if (rolled) extended += 1;
  }

  return extended;
}
