import { Types } from 'mongoose';

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { ProcedureDocument } from '@/features/procedure/schema/procedure.schema';
import {
  CreateProcedureType,
  UpdateProcedureType,
} from '@/features/procedure/validations/procedure.validation';
import { PaginatedResult, ServiceResult } from '@/shared/types/common';

type ProcedureResult = ServiceResult<ProcedureDocument>;

/**
 * `clinicId` always arrives from `clinicGuard`, never from the request body, and is passed down to
 * every repository call — a procedure belonging to another clinic reads as a 404, not a 403, so a
 * probing request cannot confirm that the id exists (PRD 02).
 */
export async function createProcedureService(
  clinicId: string,
  input: CreateProcedureType
): Promise<ProcedureResult> {
  const id = await procedureRepository.create({
    patientId: new Types.ObjectId(input.patientId),
    clinicId: new Types.ObjectId(clinicId),
    performedAt: new Date(input.performedAt),
    operatorName: input.operatorName,
    operatorUserId: input.operatorUserId ? new Types.ObjectId(input.operatorUserId) : null,
    manipulationType: input.manipulationType,
    manipulationDetail: input.manipulationDetail ?? '',
    anesthesia: input.anesthesia,
    notes: input.notes ?? '',
  });

  const created = await procedureRepository.findById(id, clinicId);
  if (!created) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: created, status: 201 };
}

export async function listByPatientService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<PaginatedResult<ProcedureDocument>>> {
  const items = await procedureRepository.findAllByPatient(patientId, clinicId);
  return { data: { items, total: items.length }, status: 200 };
}

export async function getProcedureService(
  clinicId: string,
  id: string
): Promise<ProcedureResult> {
  const procedure = await procedureRepository.findById(id, clinicId);
  if (!procedure) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: procedure, status: 200 };
}

export async function updateProcedureService(
  clinicId: string,
  id: string,
  input: UpdateProcedureType
): Promise<ProcedureResult> {
  const patch = toProcedurePatch(input);

  const matched = await procedureRepository.updateById(id, clinicId, patch);
  if (!matched) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const updated = await procedureRepository.findById(id, clinicId);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: updated, status: 200 };
}

/**
 * Removes a procedure and everything hanging off it: its care plan and every reminder that plan
 * produced.
 *
 * Cascading is not optional here. A stranded plan would keep its reminders in the dispatch sweep,
 * so a patient would go on receiving dosing notifications for a procedure the clinic had deleted.
 * Order matters — occurrences, then the plan, then the procedure — so a failure part-way through
 * never leaves reminders pointing at a plan that no longer exists.
 */
export async function deleteProcedureService(
  clinicId: string,
  id: string
): Promise<ServiceResult<{ deletedPlan: boolean; deletedOccurrences: number }>> {
  const procedure = await procedureRepository.findById(id, clinicId);
  if (!procedure) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const plan = await carePlanRepository.findByProcedureId(id, clinicId);

  let deletedOccurrences = 0;
  let deletedPlan = false;

  if (plan) {
    deletedOccurrences = await reminderOccurrenceRepository.deleteAllByCarePlan(
      plan._id.toString(),
      clinicId
    );
    deletedPlan = await carePlanRepository.deleteById(plan._id.toString(), clinicId);
  }

  const removed = await procedureRepository.deleteById(id, clinicId);
  if (!removed) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: { deletedPlan, deletedOccurrences }, status: 200 };
}

/** Only the keys actually present in the PATCH body reach `$set`, so absent keys keep their value. */
function toProcedurePatch(input: UpdateProcedureType): Partial<ProcedureDocument> {
  const patch: Partial<ProcedureDocument> = {};

  if (input.performedAt !== undefined) patch.performedAt = new Date(input.performedAt);
  if (input.operatorName !== undefined) patch.operatorName = input.operatorName;
  if (input.operatorUserId !== undefined) {
    patch.operatorUserId = input.operatorUserId ? new Types.ObjectId(input.operatorUserId) : null;
  }
  if (input.manipulationType !== undefined) patch.manipulationType = input.manipulationType;
  if (input.manipulationDetail !== undefined) patch.manipulationDetail = input.manipulationDetail;
  if (input.anesthesia !== undefined) patch.anesthesia = input.anesthesia;
  if (input.notes !== undefined) patch.notes = input.notes;

  return patch;
}
