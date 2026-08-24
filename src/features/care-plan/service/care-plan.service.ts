import { Types } from 'mongoose';

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument, CarePlanInput } from '@/features/care-plan/schema/care-plan.schema';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import {
  buildDayBuckets,
  sumTotals,
} from '@/features/care-plan/service/adherence.service';
import {
  buildOccurrences,
  DEFAULT_HORIZON_DAYS,
} from '@/features/care-plan/service/occurrence-generator.service';
import { AdherenceSummary } from '@/features/care-plan/types/care-plan.types';
import {
  ActivateCarePlanSchema,
  CreateCarePlanType,
  UpdateCarePlanType,
} from '@/features/care-plan/validations/care-plan.validation';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { canClinicWrite, resolveStatus } from '@/features/clinic/service/subscription.service';
import { sendWelcomeEmailService } from '@/features/notifications/service/email-dispatch.service';
import { sendPlanUpdatedLinkService } from '@/features/notifications/service/plan-update-email.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { resolveGuideForProcedure } from '@/features/recovery-guide/service/resolve-guide.service';
import { occurrenceTranslator } from '@/shared/const/occurrence-copy.const';
import { WRITE_ALLOWED_STATUSES } from '@/shared/const/subscription.const';
import { effectiveTimeZone, isValidTimeZone } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { PaginatedResult, ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';
import { resolvePatientLocale } from '@/shared/utils/patient-locale';

type CarePlanResult = ServiceResult<CarePlanDocument>;

/** Everything the builder submits; ids and `status` are the service's business, not the body's. */
type CarePlanContentPatch = Pick<
  CarePlanInput,
  'startsAt' | 'rehabEndsAt' | 'recoveryLogEnabled' | 'medications' | 'rehabTasks' | 'checkups'
>;

/**
 * `clinicId` always arrives from `clinicGuard`, never from the request body, and is passed to every
 * repository call — another clinic's plan reads as a 404, not a 403 (PRD 02).
 */
export async function createCarePlanService(
  clinicId: string,
  input: CreateCarePlanType
): Promise<CarePlanResult> {
  /*
    A care plan is a clinical record like a patient is, so it is behind the same subscription wall
    and answers with the same code — 402, because the request is valid and payment is what is
    missing. Enforced in the service rather than the route so every caller is covered.
  */
  if (!(await canClinicWrite(clinicId))) {
    return { data: { error: 'SUBSCRIPTION_INACTIVE' }, status: 402 };
  }

  /*
    `procedureId` is unique on the schema — one plan per procedure. Without this check a second
    submit surfaced as a raw duplicate-key crash and a 500, which reads to the clinic as "the app
    is broken" rather than "this procedure already has a plan".
  */
  const existing = await carePlanRepository.findByProcedureId(input.procedureId, clinicId);
  if (existing) return { data: { error: 'PLAN_ALREADY_EXISTS' }, status: 409 };

  // Read for the timezone alone: a checkup arrives as a zoneless wall clock and cannot be stored
  // as an instant until someone says which zone that clock is on. See `resolveCheckupTimes`.
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  const id = await carePlanRepository.create(toCreateInput(clinicId, input, clinic.timezone));

  const created = await carePlanRepository.findById(id, clinicId);
  if (!created) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: created, status: 201 };
}

export async function getCarePlanService(clinicId: string, id: string): Promise<CarePlanResult> {
  const plan = await carePlanRepository.findById(id, clinicId);
  if (!plan) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: plan, status: 200 };
}

export async function getByProcedureService(
  clinicId: string,
  procedureId: string
): Promise<CarePlanResult> {
  const plan = await carePlanRepository.findByProcedureId(procedureId, clinicId);
  if (!plan) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: plan, status: 200 };
}

/** Editing an active plan re-runs activation, so the materialised rows follow the edit (PRD 03 §3). */
export async function updateCarePlanService(
  clinicId: string,
  id: string,
  input: UpdateCarePlanType
): Promise<CarePlanResult> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  const matched = await carePlanRepository.updateById(id, clinicId, toContentPatch(input, clinic.timezone));
  if (!matched) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const updated = await carePlanRepository.findById(id, clinicId);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };
  /*
    A draft is not something the patient can read yet, so editing one sends nothing. Activation is
    what puts a plan in front of them, and it has its own email.
  */
  if (updated.status !== 'active') return { data: updated, status: 200 };

  const reactivated = await activateCarePlanService(clinicId, id);

  /*
    After activation, not before: the link this email carries lands on a portal that must already
    be showing the edit and the rebuilt reminders, or the patient opens it to the version they had
    complained about. Only on success — a rebuild that failed its own validation left the plan as
    it was, and there is nothing new to go and read.
  */
  if (reactivated.status === 200) await sendPlanUpdatedLinkService(updated, clinic);

  return reactivated;
}

/**
 * Drop the plan's *pending* rows and insert freshly built ones. The half of activation that also
 * has to run on its own, whenever the wall clock a plan was built against stops being the one the
 * patient is living on.
 *
 * `sent` / `done` / `skipped` / `missed` rows are never touched: they record what actually
 * happened, at the time it happened, and a patient who crossed a border does not retroactively
 * take yesterday's dose at a different hour.
 */
async function rebuildPlanOccurrences(
  plan: CarePlanDocument,
  timezone: string,
  locale: AppLocale
): Promise<number> {
  const clinicId = plan.clinicId.toString();
  const planId = plan._id.toString();
  const now = clock.now();

  const guide = await resolveGuideForProcedure(plan.procedureId.toString(), clinicId, locale);

  /*
    Only the future is inserted. `buildOccurrences` is deterministic from `plan.startsAt`, so it
    returns the plan's history alongside its future, and `deletePendingByCarePlan` clears only
    `pending`. Without this filter a rebuild laid a fresh `pending` duplicate over every dose the
    patient had already been reminded of: anything inside `GRACE_HOURS` was sent twice, and
    everything older was marked `missed` on the next sweep — a clinic correcting a typo invented a
    fortnight of non-adherence for a patient who had missed nothing. Both rebuild paths reach this
    (a clinic edit, and a patient opening the portal from a new zone). `extendPlan` carries the
    same guard for the same reason.
  */
  const drafts = buildOccurrences(
    plan,
    timezone,
    DEFAULT_HORIZON_DAYS,
    occurrenceTranslator(locale),
    now,
    guide
  ).filter(draft => draft.dueAt.getTime() >= now.getTime());

  await reminderOccurrenceRepository.deletePendingByCarePlan(planId, clinicId);
  if (drafts.length > 0) await reminderOccurrenceRepository.insertMany(drafts);

  return drafts.length;
}

/**
 * Re-materialises every active plan a patient has against a zone they have just moved into.
 *
 * Occurrence rows hold absolute instants, resolved from the prescribed wall clock at the moment
 * they were generated. That is what makes dispatch a pure read — and it is also why a patient
 * changing zone cannot be handled by the dispatcher or the portal alone: the rows themselves say
 * 05:30 UTC, and only rebuilding them makes that mean 09:30 in the place the patient now is.
 *
 * Returns how many rows were written, which is what the caller logs. A patient with no active
 * plan is not an error — their zone is still worth recording for the plan that comes next.
 */
export async function regeneratePlansForTimezoneService(
  patientId: string,
  clinicId: string,
  timezone: string
): Promise<ServiceResult<{ plans: number; occurrences: number }>> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  const plans = await carePlanRepository.findActiveByPatient(patientId, clinicId);
  const patient = await patientRepository.findById(patientId, clinicId);
  const locale = resolvePatientLocale(patient, clinic);

  let occurrences = 0;
  for (const plan of plans) {
    occurrences += await rebuildPlanOccurrences(plan, timezone, locale);
  }

  return { data: { plans: plans.length, occurrences }, status: 200 };
}

/**
 * PRD 03 §Activation: validate completeness → drop the plan's *pending* rows → insert the freshly
 * built ones → flip to `active`. `sent` / `done` / `skipped` / `missed` rows are never deleted, so
 * the adherence history of an edited plan survives intact.
 */
export async function activateCarePlanService(
  clinicId: string,
  id: string
): Promise<CarePlanResult> {
  const plan = await carePlanRepository.findById(id, clinicId);
  if (!plan) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const complete = ActivateCarePlanSchema.safeParse(plan);
  if (!complete.success) return { data: { error: 'INCOMPLETE_PLAN' }, status: 422 };

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  /*
    Activation is the moment reminders are materialised and start being sent, so it is gated even
    though the plan itself already exists — a clinic whose trial ran out mid-draft can finish
    writing the plan, but cannot switch on the messaging it pays for.

    Read off the clinic document already loaded above rather than through `canClinicWrite`, which
    would fetch the same row a second time.
  */
  if (!WRITE_ALLOWED_STATUSES.includes(resolveStatus(clinic, clock.now()))) {
    return { data: { error: 'SUBSCRIPTION_INACTIVE' }, status: 402 };
  }

  /*
    Checked before generating anything. An invalid zone throws inside `Intl.DateTimeFormat`, which
    reached the clinic as a bare 500 with no clue that a settings field was at fault. Existing
    clinics may still hold a bad value written before the field was validated, so this cannot rely
    on the write-side check alone.
  */
  if (!isValidTimeZone(clinic.timezone)) {
    return { data: { error: 'INVALID_CLINIC_TIMEZONE' }, status: 422 };
  }

  /*
    The patient's zone, not the clinic's, once the portal has learned it. A prescribed time is
    wall clock where the *patient* is: someone operated on in Tbilisi and recovering at home in
    Amsterdam takes their 09:30 dose at 09:30 Amsterdam, and generating against the clinic would
    put every reminder two hours out for the rest of their recovery. It falls back to the clinic's
    zone, which is the right answer until the patient has ever opened their portal.
  */
  const patient = await patientRepository.findById(plan.patientId.toString(), clinicId);
  const timezone = effectiveTimeZone(patient?.timezone ?? '', clinic.timezone);

  // Same rule the emails follow: the patient's own language wins, the clinic's is the fallback for
  // a record written before the field existed.
  await rebuildPlanOccurrences(plan, timezone, resolvePatientLocale(patient, clinic));

  await carePlanRepository.updateById(id, clinicId, { status: 'active' });

  const activated = await carePlanRepository.findById(id, clinicId);
  if (!activated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  /*
    The whole plan goes to the patient here rather than when their record is saved: medications,
    procedures, the checkup and the guide only exist once a plan is built, so an email sent earlier
    would arrive almost empty. Failure is logged inside the service and never fails activation — a
    live plan with no email beats no plan at all.

    Only on the transition *into* `active`, though. Editing a live plan re-runs activation to keep
    the materialised rows following the edit, which meant every correction — a dosage typo, a
    moved appointment — re-sent the largest email the product has, in full, to a patient who had
    already read it. `status` is read off the document as it was *before* the flip below, so a
    genuine draft → active activation still sends and a re-activation of a finished plan still
    counts as a new course of treatment.
  */
  if (plan.status !== 'active') await sendWelcomeEmailService(activated, clinic);

  return { data: activated, status: 200 };
}

/**
 * The rows a plan has already materialised. `findByPatientAndRange` is the only indexed read that
 * spans a plan, so the plan's own rows are picked out of the patient's window here — a service
 * decision, which is exactly where it belongs (CLAUDE.md §8).
 */
export async function listOccurrencesService(
  clinicId: string,
  carePlanId: string
): Promise<ServiceResult<PaginatedResult<ReminderOccurrenceDocument>>> {
  const plan = await carePlanRepository.findById(carePlanId, clinicId);
  if (!plan) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const items = await reminderOccurrenceRepository.findByCarePlan(carePlanId, clinicId);

  return { data: { items, total: items.length }, status: 200 };
}

/** PRD 03 §5 — counts by status over the plan window plus the trailing week bucketed by day. */
export async function getAdherenceService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<AdherenceSummary>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  // Same exposure as activation — the day buckets are built in the clinic's zone.
  if (!isValidTimeZone(clinic.timezone)) {
    return { data: { error: 'INVALID_CLINIC_TIMEZONE' }, status: 422 };
  }

  const plans = await carePlanRepository.findActiveByPatient(patientId, clinicId);
  const { totals, excludedUndelivered } = await sumTotals(plans, clinicId);
  const lastSevenDays = await buildDayBuckets(patientId, clinic.timezone);

  return { data: { patientId, totals, lastSevenDays, excludedUndelivered }, status: 200 };
}

/**
 * Shared by create and update — the plan content, with ids and status handled by the caller.
 *
 * `InferSchemaType` types subdocument arrays as `DocumentArray`, the *hydrated* shape, and adds the
 * `timestamps` fields. A `create()`/`$set` payload is plain data that Mongoose hydrates and stamps
 * itself, so the plain object is narrowed to the document type here. `DocumentArray` is assignable
 * to a plain array, which is what makes this a narrowing assertion and not an `unknown` cast.
 */
/**
 * Shared by create and update, and the point at which each appointment's wall clock is anchored in
 * the clinic's zone. See `clock.zonedCivilToUtc` for what
 * `datetime-local` submits and why the raw parse put every Tbilisi checkup four hours late.
 *
 * The clinic's zone, deliberately, and not the patient's `effectiveTimeZone` that doses use: a
 * checkup is a visit *to the clinic*, booked against the clinic's own calendar, and it does not
 * move because the patient travelled. The portal still renders it in the patient's zone, which
 * tells someone recovering abroad what time to be there in their own local terms.
 */
function toContentPatch(input: UpdateCarePlanType, timeZone: string): CarePlanContentPatch {
  const content = {
    startsAt: input.startsAt,
    rehabEndsAt: input.rehabEndsAt,
    recoveryLogEnabled: input.recoveryLogEnabled,
    medications: input.medications,
    rehabTasks: input.rehabTasks,
    checkups: input.checkups.map(checkup => ({
      ...checkup,
      scheduledAt: clock.zonedCivilToUtc(checkup.scheduledAt, timeZone),
      completedAt: null,
    })),
  };
  return content as CarePlanContentPatch;
}

function toCreateInput(clinicId: string, input: CreateCarePlanType, timeZone: string): CarePlanInput {
  const draft = {
    procedureId: new Types.ObjectId(input.procedureId),
    patientId: new Types.ObjectId(input.patientId),
    clinicId: new Types.ObjectId(clinicId),
    status: 'draft',
    ...toContentPatch(input, timeZone),
  };
  return draft as CarePlanInput;
}
