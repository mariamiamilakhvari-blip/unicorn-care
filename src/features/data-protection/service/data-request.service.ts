import mongoose from 'mongoose';

import { dataRequestRepository } from '@/features/data-protection/repository/data-request.repository';
import { DataRequestDocument } from '@/features/data-protection/schema/data-request.schema';
import { DataRequestView } from '@/features/data-protection/types/data-protection.types';
import {
  DataRequestCreateType,
  DataRequestResolveType,
} from '@/features/data-protection/validations/data-protection.validation';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { DataRequestKind, DataRequestStatus } from '@/shared/const/data-request.const';
import { ERASABLE_PATIENT_FIELDS, ERASED_PLACEHOLDER } from '@/shared/const/retention.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

function toView(request: DataRequestDocument): DataRequestView {
  return {
    id: request._id.toString(),
    kind: request.kind as DataRequestKind,
    status: request.status as DataRequestStatus,
    detail: request.detail ?? '',
    resolution: request.resolution ?? '',
    requestedAt: request.requestedAt.toISOString(),
    resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
  };
}

/**
 * A patient filing a correction or erasure request from the portal.
 *
 * The request is recorded and routed to the clinic; nothing is changed on the record here. Both
 * rights are real and both are exercisable — but a correction to a clinical record is a clinical
 * act, and an erasure runs into the retention the Law of Georgia on Health Care mandates. A portal
 * button that acted directly would either let a patient rewrite their own medication history or
 * put the clinic in breach of the statute requiring it to keep one.
 *
 * Duplicate open requests of the same kind are refused rather than stacked. A patient who presses
 * the button twice has not made two requests, and a clinic queue that says they did is a queue
 * that gets ignored.
 */
export async function createDataRequestService(
  patientId: string,
  clinicId: string,
  input: DataRequestCreateType,
  ipAddress: string
): Promise<ServiceResult<DataRequestView>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const existing = await dataRequestRepository.findByPatient(patientId);
  const duplicate = existing.some(item => item.kind === input.kind && item.status === 'open');
  if (duplicate) return { data: { error: 'REQUEST_ALREADY_OPEN' }, status: 409 };

  const requestedAt = clock.now();
  const id = await dataRequestRepository.create({
    patientId: new mongoose.Types.ObjectId(patientId),
    clinicId: new mongoose.Types.ObjectId(clinicId),
    kind: input.kind,
    status: 'open',
    detail: input.detail,
    resolution: '',
    requestedAt,
    resolvedAt: null,
    resolvedBy: null,
    ipAddress,
  });

  const created = await dataRequestRepository.findById(id, clinicId);
  if (!created) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toView(created), status: 201 };
}

/** The patient's own history of what they have asked for and what they were told. */
export async function listPatientDataRequestsService(
  patientId: string
): Promise<ServiceResult<DataRequestView[]>> {
  const requests = await dataRequestRepository.findByPatient(patientId);
  return { data: requests.map(toView), status: 200 };
}

/** The clinic's queue, oldest first — the statutory clock starts when the patient files. */
export async function listOpenDataRequestsService(
  clinicId: string
): Promise<ServiceResult<DataRequestView[]>> {
  const requests = await dataRequestRepository.findOpenByClinic(clinicId);
  return { data: requests.map(toView), status: 200 };
}

/**
 * The clinic answering a request.
 *
 * `completed` on an erasure applies it — see `applyErasure` below for exactly how much it erases.
 * `refused` applies nothing and records why, which is not the platform being unhelpful: "the Law
 * on Health Care requires this record to be kept for fifteen years" is a lawful answer, and one
 * the patient is entitled to receive in writing rather than as silence.
 *
 * A request already answered is refused a second answer. The resolution is what the patient was
 * told, and letting it be rewritten later would leave the clinic unable to show what it said.
 */
export async function resolveDataRequestService(
  requestId: string,
  clinicId: string,
  userId: string,
  input: DataRequestResolveType
): Promise<ServiceResult<DataRequestView>> {
  const request = await dataRequestRepository.findById(requestId, clinicId);
  if (!request) return { data: { error: 'NOT_FOUND' }, status: 404 };
  if (request.status !== 'open') return { data: { error: 'ALREADY_RESOLVED' }, status: 409 };

  const resolvedAt = clock.now();

  if (input.status === 'completed' && request.kind === 'erasure') {
    const applied = await applyErasure(request.patientId.toString(), clinicId, resolvedAt);
    if (!applied) return { data: { error: 'NOT_FOUND' }, status: 404 };
  }

  await dataRequestRepository.updateById(requestId, clinicId, {
    status: input.status,
    resolution: input.resolution,
    resolvedAt,
    resolvedBy: new mongoose.Types.ObjectId(userId),
  });

  const updated = await dataRequestRepository.findById(requestId, clinicId);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toView(updated), status: 200 };
}

/**
 * Erases what may lawfully be erased, and nothing else.
 *
 * The two statutes conflict here and both bind. The Law of Georgia on Personal Data Protection
 * gives the patient a right to erasure; the Law on Health Care requires the clinical record to be
 * kept for the period `CLINICAL_RECORD_RETENTION_YEARS` sets, regardless. The resolution is not to pick
 * a side: identifying and contact data goes, the clinical log stays and is severed from the
 * identifiers that made it personal data.
 *
 * So this clears exactly `ERASABLE_PATIENT_FIELDS` and touches no other collection. Care plans,
 * reminder occurrences, recovery logs and symptom reports are all left intact — deleting them is
 * the thing the retention statute forbids, and a clinic that did it could not later evidence the
 * care it gave.
 *
 * Reminders are stopped at the same time. Continuing to email an address that has just been erased
 * would be incoherent, and the patient plainly did not consent to it.
 *
 * `allergies`, `dateOfBirth` and `sex` deliberately survive. A dose is only interpretable against
 * them, and an allergy list is the one field here whose deletion could injure someone.
 */
async function applyErasure(
  patientId: string,
  clinicId: string,
  erasedAt: Date
): Promise<boolean> {
  const cleared: Record<string, string> = {};
  for (const field of ERASABLE_PATIENT_FIELDS) {
    // Names keep a visible marker so a clinic can tell an erased record from a badly entered one;
    // everything else is simply emptied, since a blank phone number reads correctly on its own.
    cleared[field] = field === 'firstName' || field === 'lastName' ? ERASED_PLACEHOLDER : '';
  }

  return patientRepository.updateById(patientId, clinicId, {
    ...cleared,
    erasedAt,
    notificationsRevokedAt: erasedAt,
    portalAccessRevokedAt: erasedAt,
  });
}
