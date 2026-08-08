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
 *
 * A plan whose own window closes before the trigger point can never satisfy that test, however
 * often it is rebuilt — there is simply no future left to generate. Without this guard such a
 * plan was rebuilt on every sweep, five minutes apart, for as long as it stayed active: the
 * regeneration below starts from `plan.startsAt`, so each pass re-created the plan's whole
 * history as fresh `pending` rows and the same sweep then marked them `missed`. Two plans doing
 * that produced thousands of junk rows and a wildly overstated missed count.
 */
async function needsExtension(plan: CarePlanDocument, now: Date): Promise<boolean> {
  const triggerAt = clock.addDays(now, EXTENSION_TRIGGER_DAYS);

  // Nothing to extend into. The plan ends before the horizon we would be extending towards.
  if (plan.rehabEndsAt.getTime() <= triggerAt.getTime()) return false;
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

  /*
    `buildOccurrences` is deterministic from `plan.startsAt`, so it returns the plan's entire
    history as well as its future. Only the future is inserted: a reminder for a moment that has
    already passed cannot be delivered, and creating one only to mark it `missed` on the same
    sweep manufactures adherence data that describes nothing a patient did.

    This is the guard that holds regardless of why an extension ran, which is why it exists
    alongside the trigger check above rather than instead of it.
  */
  const drafts = buildOccurrences(plan, clinic.timezone, horizonDays).filter(
    draft => draft.dueAt.getTime() >= now.getTime()
  );
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
