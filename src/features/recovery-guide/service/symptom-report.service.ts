import { Types } from 'mongoose';

import { sendSymptomAlertService } from '@/features/notifications/service/symptom-alert.service';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { symptomReportRepository } from '@/features/recovery-guide/repository/symptom-report.repository';
import { SymptomReportDocument } from '@/features/recovery-guide/schema/symptom-report.schema';
import { SymptomReportView } from '@/features/recovery-guide/types/recovery-guide.types';
import {
  CreateSymptomReportType,
  ReviewSymptomReportType,
} from '@/features/recovery-guide/validations/recovery-guide.validation';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

function toView(report: SymptomReportDocument): SymptomReportView {
  return {
    id: report._id.toString(),
    patientId: report.patientId.toString(),
    procedureId: report.procedureId ? report.procedureId.toString() : null,
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

  const id = await symptomReportRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: new Types.ObjectId(clinicId),
    procedureId: latest ? latest._id : null,
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

  return { data: toView(created), status: 201 };
}

export async function listSymptomReportsService(
  clinicId: string,
  status?: SymptomReportView['status']
): Promise<ServiceResult<{ items: SymptomReportView[]; openCount: number }>> {
  const reports = await symptomReportRepository.findAllByClinic(clinicId, status);
  const openCount = await symptomReportRepository.countOpenForClinic(clinicId);

  return { data: { items: reports.map(toView), openCount }, status: 200 };
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
