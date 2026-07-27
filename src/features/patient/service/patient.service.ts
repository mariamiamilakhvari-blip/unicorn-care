import { Types } from 'mongoose';

import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { PatientListResult, PatientSummary } from '@/features/patient/types/patient.types';
import {
  CreatePatientType,
  UpdatePatientType,
} from '@/features/patient/validations/patient.validation';
import { ServiceResult } from '@/shared/types/common';

export const PATIENT_PAGE_SIZE = 20;

function toPatientSummary(patient: PatientDocument): PatientSummary {
  return {
    id: patient._id.toString(),
    firstName: patient.firstName,
    lastName: patient.lastName,
    // Schema defaults these but the inferred types stay nullable — normalise for the wire.
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
    sex: patient.sex,
    locale: patient.locale,
    allergies: patient.allergies ?? [],
    notes: patient.notes ?? '',
    isArchived: patient.isArchived,
  };
}

export async function createPatientService(
  clinicId: string,
  input: CreatePatientType
): Promise<ServiceResult<PatientSummary>> {
  const patientId = await patientRepository.create({
    ...input,
    clinicId: new Types.ObjectId(clinicId),
    isArchived: false,
  });

  const created = await patientRepository.findById(patientId, clinicId);
  if (!created) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toPatientSummary(created), status: 201 };
}

/**
 * `query` switches to the clinic-scoped regex search, which the repository returns unpaginated —
 * a clinic's roster is small enough that a single result set is the honest answer here.
 */
export async function listPatientsService(
  clinicId: string,
  page = 1,
  limit = PATIENT_PAGE_SIZE,
  query?: string
): Promise<ServiceResult<PatientListResult>> {
  if (query) {
    const matches = await patientRepository.search(clinicId, query);
    const items = matches.map(toPatientSummary);
    return { data: { items, total: items.length, page: 1, limit: items.length }, status: 200 };
  }

  const { items, total } = await patientRepository.findAllByClinic(clinicId, page, limit);
  return { data: { items: items.map(toPatientSummary), total, page, limit }, status: 200 };
}

/**
 * 404 covers both "no such patient" and "belongs to another clinic". The distinction is
 * deliberately not exposed — it would leak the existence of other clinics' records.
 */
export async function getPatientService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<PatientSummary>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return { data: toPatientSummary(patient), status: 200 };
}

export async function updatePatientService(
  clinicId: string,
  patientId: string,
  input: UpdatePatientType
): Promise<ServiceResult<PatientSummary>> {
  const updated = await patientRepository.updateById(patientId, clinicId, input);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return getPatientService(clinicId, patientId);
}

export async function archivePatientService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<{ id: string; isArchived: boolean }>> {
  const archived = await patientRepository.archiveById(patientId, clinicId);
  if (!archived) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return { data: { id: patientId, isArchived: true }, status: 200 };
}
