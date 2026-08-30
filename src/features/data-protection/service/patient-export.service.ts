import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { consentRecordRepository } from '@/features/data-protection/repository/consent-record.repository';
import { dataRequestRepository } from '@/features/data-protection/repository/data-request.repository';
import { ConsentRecordDocument } from '@/features/data-protection/schema/consent-record.schema';
import { DataRequestDocument } from '@/features/data-protection/schema/data-request.schema';
import {
  ConsentView,
  DataRequestView,
  PatientExport,
  PatientExportOccurrence,
  PatientExportPlan,
} from '@/features/data-protection/types/data-protection.types';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { symptomReportRepository } from '@/features/recovery-guide/repository/symptom-report.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { ConsentSource, ConsentType, PATIENT_REVOCABLE_CONSENTS } from '@/shared/const/consent-type.const';
import { DataRequestKind, DataRequestStatus } from '@/shared/const/data-request.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

/**
 * Ceiling on the reminder history one export carries.
 *
 * A year-long plan at four doses a day is over fourteen hundred rows, and the whole point of this
 * document is that a patient can open it. Newest first, so what is cut is the oldest part of a
 * history the plan itself still describes in full.
 */
const OCCURRENCE_EXPORT_LIMIT = 2000;

/**
 * Everything held about one patient, assembled for them to read or take elsewhere.
 *
 * The Law of Georgia on Personal Data Protection gives the data subject a right to know what is
 * processed about them and to receive it in a usable form. That is the whole specification of this
 * function, and it explains the two things about it that would otherwise look wrong.
 *
 * First, it reads eight collections in sequence and makes no attempt to be fast. It runs when a
 * patient presses a button, at most a handful of times in that record's life, and correctness —
 * meaning completeness — is the only property that matters. An export that quietly omitted a
 * collection would be worse than no export at all, because the patient would believe they had the
 * whole record.
 *
 * Second, it is deliberately not the portal's plan view with more fields. The portal shows a
 * window around today; this is the record. Nothing here is filtered by status, date or relevance.
 *
 * Internal identifiers are left out throughout. They are not data *about* the patient — they are
 * how this platform happens to store it, they mean nothing to another controller receiving the
 * file, and including them would leak the shape of the system to no one's benefit.
 */
export async function buildPatientExportService(
  patientId: string,
  clinicId: string
): Promise<ServiceResult<PatientExport>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  const [consents, requests, plans, occurrences, recoveryLogs, symptomReports] = await Promise.all([
    consentRecordRepository.findAllByPatient(patientId),
    dataRequestRepository.findByPatient(patientId),
    carePlanRepository.findAllByPatient(patientId, clinicId),
    reminderOccurrenceRepository.findAllByPatient(patientId, clinicId, OCCURRENCE_EXPORT_LIMIT),
    recoveryLogRepository.findByPatient(patientId, clinicId),
    symptomReportRepository.findByPatient(patientId),
  ]);

  return {
    data: {
      exportedAt: clock.now().toISOString(),
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email ?? '',
        phone: patient.phone ?? '',
        age: patient.age ?? null,
        sex: patient.sex,
        locale: patient.locale,
        timezone: patient.timezone ?? '',
        allergies: patient.allergies ?? [],
      },
      /*
        Who processed the data, not decoration. A patient holding an export with no controller
        named on it cannot exercise any further right over what it contains.
      */
      clinic: {
        name: clinic.name,
        email: clinic.email ?? '',
        phone: clinic.phone ?? '',
        addressLine: clinic.addressLine ?? '',
      },
      /*
        The full consent history, withdrawals included — unlike the portal's settings screen, which
        shows only what stands. "When did I turn reminders off" is exactly the kind of question an
        export exists to answer.
      */
      consents: consents.map(toConsentView),
      dataRequests: requests.map(toDataRequestView),
      carePlans: plans.map(toExportPlan),
      occurrences: occurrences.map(toExportOccurrence),
      recoveryLogs: recoveryLogs.map(log => ({
        loggedAt: log.loggedAt.toISOString(),
        painLevel: log.painLevel ?? null,
        swelling: log.swelling ?? '',
        mood: log.mood ?? '',
        note: log.note ?? '',
      })),
      symptomReports: symptomReports.map(report => ({
        reportedAt: report.createdAt.toISOString(),
        warningTitle: report.warningTitle ?? '',
        severity: report.severity ?? '',
        note: report.note ?? '',
        status: report.status,
        /*
          The clinic's own note on the report is included. It is a clinician's words about this
          patient, which makes it the patient's personal data too — withholding it because it was
          uncomfortable to write is not a basis the statute recognises.
        */
        clinicNote: report.clinicNote ?? '',
      })),
    },
    status: 200,
  };
}

function toConsentView(record: ConsentRecordDocument): ConsentView {
  const type = record.consentType as ConsentType;
  return {
    type,
    source: record.source as ConsentSource,
    grantedAt: record.grantedAt.toISOString(),
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    consentTextVersion: record.consentTextVersion,
    isRevocable: PATIENT_REVOCABLE_CONSENTS.includes(type),
  };
}

function toDataRequestView(request: DataRequestDocument): DataRequestView {
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
 * `instructions` is carried through in full.
 *
 * It is left out of every notification the platform sends — a lock-screen preview is readable by
 * anyone holding the phone — but that is a rule about broadcasting, not about the record. Here the
 * patient is reading their own file behind their own session, and withholding the instructions
 * their clinician wrote would make the export incomplete for no privacy gain at all.
 */
function toExportPlan(plan: CarePlanDocument): PatientExportPlan {
  return {
    status: plan.status,
    startsAt: plan.startsAt.toISOString(),
    rehabEndsAt: plan.rehabEndsAt ? plan.rehabEndsAt.toISOString() : null,
    medications: (plan.medications ?? []).map(item => ({
      name: item.name,
      dosage: item.dosage,
      timesOfDay: item.timesOfDay ?? [],
      instructions: item.instructions ?? '',
    })),
    rehabTasks: (plan.rehabTasks ?? []).map(item => ({
      title: item.title,
      timesOfDay: item.timesOfDay ?? [],
    })),
    checkups: (plan.checkups ?? []).map(item => ({
      title: item.title,
      scheduledAt: item.scheduledAt.toISOString(),
      location: item.location ?? '',
    })),
  };
}

/**
 * `scheduledAt` only. `dueAt` is when the platform decided to send a notification, which is an
 * implementation detail of the reminder system rather than a fact about the patient's care — and
 * printing it here would repeat the exact confusion the two fields exist to prevent.
 */
function toExportOccurrence(occurrence: ReminderOccurrenceDocument): PatientExportOccurrence {
  return {
    kind: occurrence.kind,
    title: occurrence.title,
    scheduledAt: (occurrence.scheduledAt ?? occurrence.dueAt).toISOString(),
    status: occurrence.status,
    completedAt: occurrence.completedAt ? occurrence.completedAt.toISOString() : null,
  };
}
