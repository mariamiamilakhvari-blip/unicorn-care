import { Types } from 'mongoose';

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { sendSymptomAlertService } from '@/features/notifications/service/symptom-alert.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { symptomReportRepository } from '@/features/recovery-guide/repository/symptom-report.repository';
import { SymptomReportDocument } from '@/features/recovery-guide/schema/symptom-report.schema';
import {
  SymptomReportPatientView,
  SymptomReportView,
} from '@/features/recovery-guide/types/recovery-guide.types';
import {
  CreateSymptomReportType,
  ReviewSymptomReportType,
} from '@/features/recovery-guide/validations/recovery-guide.validation';
import { ERASED_PLACEHOLDER } from '@/shared/const/retention.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

/**
 * The patient as the clinic's queue needs them: a name to recognise and a number to ring.
 *
 * An erased record reads as no name rather than as the literal placeholder. `[ERASED] [ERASED]`
 * on a symptom card is worse than an empty one — it looks like a rendering fault, and the reader
 * has to work out that it means the patient exercised a right rather than that the page broke.
 * The report itself stays: statutory retention keeps the clinical log after the identity around
 * it goes.
 */
function toPatientView(patient: PatientDocument): SymptomReportPatientView {
  const isErased = patient.firstName === ERASED_PLACEHOLDER;

  return {
    id: patient._id.toString(),
    name: isErased ? '' : `${patient.firstName} ${patient.lastName}`.trim(),
    phone: patient.phone ?? '',
  };
}

function toView(
  report: SymptomReportDocument,
  patient: PatientDocument | null
): SymptomReportView {
  return {
    id: report._id.toString(),
    patientId: report.patientId.toString(),
    patient: patient ? toPatientView(patient) : null,
    procedureId: report.procedureId ? report.procedureId.toString() : null,
    planId: report.planId ? report.planId.toString() : null,
    warningTitle: report.warningTitle ?? '',
    severity: report.severity ?? '',
    note: report.note ?? '',
    status: report.status,
    clinicNote: report.clinicNote ?? '',
    createdAt: report.createdAt.toISOString(),
  };
}

/**
 * Files a patient's report for the clinic to read.
 *
 * Deliberately does no assessment: no scoring, no ranking, no auto-escalation. The system's whole
 * job here is to get a human clinician looking at it — anything cleverer would be the product
 * making a clinical judgement it is not qualified to make.
 */
export async function createSymptomReportService(
  patientId: string,
  clinicId: string,
  input: CreateSymptomReportType
): Promise<ServiceResult<SymptomReportView>> {
  const procedures = await procedureRepository.findAllByPatient(patientId, clinicId);
  const latest = procedures[0] ?? null;

  /*
    Which plan they were part-way through, recorded so the clinician reading this knows where in a
    recovery it happened. Null when there is none — a patient can write in before activation,
    after a plan finishes, or with no plan at all, and none of those is a reason to refuse a
    report. First of the active plans: a patient with two running is rare and the queue shows the
    text either way, so picking one is better than storing nothing.
  */
  const activePlans = await carePlanRepository.findActiveByPatient(patientId, clinicId);
  const activePlan = activePlans[0] ?? null;

  const id = await symptomReportRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: new Types.ObjectId(clinicId),
    procedureId: latest ? latest._id : null,
    planId: activePlan ? activePlan._id : null,
    warningTitle: input.warningTitle,
    severity: input.severity,
    note: input.note,
    status: 'needs_review',
    reviewedByUserId: null,
    reviewedAt: null,
    clinicNote: '',
  });

  const reports = await symptomReportRepository.findByPatient(patientId);
  const created = reports.find(report => report._id.toString() === id);
  if (!created) return { data: { error: 'NOT_FOUND' }, status: 404 };

  /*
    Told, not triaged. The row is already filed and visible in the dashboard queue; this only
    stops it waiting there until somebody happens to look.

    Awaited rather than left dangling — a floating promise in a serverless function can be killed
    when the response returns — but its result is ignored on purpose. Filing the report is what
    must not fail: a report stored and unannounced is recoverable by opening the dashboard, while
    one rejected because a mail provider was down is a patient told their message did not send.
  */
  await sendSymptomAlertService(patientId, clinicId, input.warningTitle, input.severity);

  const patient = await patientRepository.findById(patientId, clinicId);

  return { data: toView(created, patient), status: 201 };
}

/**
 * The clinic's queue, with the person behind each report attached.
 *
 * The patients are fetched in one query keyed by the ids the reports carry, not one lookup per
 * row: this runs on every dashboard load and the queue has no upper bound, so a per-row join
 * would put an unbounded number of round trips behind the clinic's first screen.
 *
 * A report whose patient is missing still comes back, carrying `patient: null`. Dropping it would
 * be the wrong trade in both directions — the record is retained deliberately after an erasure,
 * and a symptom silently vanishing from a review queue is exactly the failure this queue exists
 * to prevent.
 */
export async function listSymptomReportsService(
  clinicId: string,
  status?: SymptomReportView['status']
): Promise<ServiceResult<{ items: SymptomReportView[]; openCount: number }>> {
  const reports = await symptomReportRepository.findAllByClinic(clinicId, status);
  const openCount = await symptomReportRepository.countOpenForClinic(clinicId);

  const patientIds = [...new Set(reports.map(report => report.patientId.toString()))];
  const patients = await patientRepository.findManyByIds(patientIds, clinicId);
  const byId = new Map(patients.map(patient => [patient._id.toString(), patient]));

  const items = reports.map(report => toView(report, byId.get(report.patientId.toString()) ?? null));

  return { data: { items, openCount }, status: 200 };
}

export async function reviewSymptomReportService(
  clinicId: string,
  userId: string,
  reportId: string,
  input: ReviewSymptomReportType
): Promise<ServiceResult<{ updated: boolean }>> {
  const updated = await symptomReportRepository.updateById(reportId, clinicId, {
    status: input.status,
    clinicNote: input.clinicNote,
    reviewedByUserId: new Types.ObjectId(userId),
    reviewedAt: clock.now(),
  });

  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return { data: { updated }, status: 200 };
}
