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
import { sendWelcomeEmailService } from '@/features/notifications/service/email-dispatch.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { resolveGuideForProcedure } from '@/features/recovery-guide/service/resolve-guide.service';
import { defaultOccurrenceTranslator } from '@/shared/const/occurrence-copy.const';
import { isValidTimeZone } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { PaginatedResult, ServiceResult } from '@/shared/types/common';

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
    `procedureId` is unique on the schema — one plan per procedure. Without this check a second
    submit surfaced as a raw duplicate-key crash and a 500, which reads to the clinic as "the app
    is broken" rather than "this procedure already has a plan".
  */
  const existing = await carePlanRepository.findByProcedureId(input.procedureId, clinicId);
  if (existing) return { data: { error: 'PLAN_ALREADY_EXISTS' }, status: 409 };

  const id = await carePlanRepository.create(toCreateInput(clinicId, input));

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
  const matched = await carePlanRepository.updateById(id, clinicId, toContentPatch(input));
  if (!matched) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const updated = await carePlanRepository.findById(id, clinicId);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };
  if (updated.status !== 'active') return { data: updated, status: 200 };

  return activateCarePlanService(clinicId, id);
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
    Checked before generating anything. An invalid zone throws inside `Intl.DateTimeFormat`, which
    reached the clinic as a bare 500 with no clue that a settings field was at fault. Existing
    clinics may still hold a bad value written before the field was validated, so this cannot rely
    on the write-side check alone.
  */
  if (!isValidTimeZone(clinic.timezone)) {
    return { data: { error: 'INVALID_CLINIC_TIMEZONE' }, status: 422 };
  }

  const guide = await resolveGuideForProcedure(
    plan.procedureId.toString(),
    clinicId,
    clinic.locale
  );

  const drafts = buildOccurrences(
    plan,
    clinic.timezone,
    DEFAULT_HORIZON_DAYS,
    defaultOccurrenceTranslator,
    clock.now(),
    guide
  );
  await reminderOccurrenceRepository.deletePendingByCarePlan(id, clinicId);
  if (drafts.length > 0) await reminderOccurrenceRepository.insertMany(drafts);

  await carePlanRepository.updateById(id, clinicId, { status: 'active' });

  const activated = await carePlanRepository.findById(id, clinicId);
  if (!activated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  /*
    The whole plan goes to the patient here rather than when their record is saved: medications,
    procedures, the checkup and the guide only exist once a plan is built, so an email sent earlier
    would arrive almost empty. Failure is logged inside the service and never fails activation — a
    live plan with no email beats no plan at all.
  */
  await sendWelcomeEmailService(activated, clinic);

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
  const totals = await sumTotals(plans, clinicId);
  const lastSevenDays = await buildDayBuckets(patientId, clinic.timezone);

  return { data: { patientId, totals, lastSevenDays }, status: 200 };
}

/**
 * Shared by create and update — the plan content, with ids and status handled by the caller.
 *
 * `InferSchemaType` types subdocument arrays as `DocumentArray`, the *hydrated* shape, and adds the
 * `timestamps` fields. A `create()`/`$set` payload is plain data that Mongoose hydrates and stamps
 * itself, so the plain object is narrowed to the document type here. `DocumentArray` is assignable
 * to a plain array, which is what makes this a narrowing assertion and not an `unknown` cast.
 */
function toContentPatch(input: UpdateCarePlanType): CarePlanContentPatch {
  const content = {
    startsAt: input.startsAt,
    rehabEndsAt: input.rehabEndsAt,
    recoveryLogEnabled: input.recoveryLogEnabled,
    medications: input.medications,
    rehabTasks: input.rehabTasks,
    checkups: input.checkups.map(checkup => ({ ...checkup, completedAt: null })),
  };
  return content as CarePlanContentPatch;
}

function toCreateInput(clinicId: string, input: CreateCarePlanType): CarePlanInput {
  const draft = {
    procedureId: new Types.ObjectId(input.procedureId),
    patientId: new Types.ObjectId(input.patientId),
    clinicId: new Types.ObjectId(clinicId),
    status: 'draft',
    ...toContentPatch(input),
  };
  return draft as CarePlanInput;
}
