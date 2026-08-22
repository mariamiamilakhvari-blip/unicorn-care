import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn(), deleteById: vi.fn() },
}));
vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/procedure/repository/procedure.repository', () => ({
  procedureRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/rating/repository/rating.repository', () => ({
  ratingRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/recovery-log/repository/recovery-log.repository', () => ({
  recoveryLogRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/recovery-log/repository/patient-photo.repository', () => ({
  patientPhotoRepository: { findByPatient: vi.fn(), deleteAllByPatient: vi.fn() },
}));
vi.mock('@/features/recovery-log/repository/photo-access-event.repository', () => ({
  photoAccessEventRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/recovery-guide/repository/symptom-report.repository', () => ({
  symptomReportRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/patient/repository/patient-access-token.repository', () => ({
  patientAccessTokenRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/patient/repository/patient-portal-link.repository', () => ({
  patientPortalLinkRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/notifications/repository/push-subscription.repository', () => ({
  pushSubscriptionRepository: { deleteAllByPatients: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/notifications/repository/email-event.repository', () => ({
  emailEventRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/data-protection/repository/consent-record.repository', () => ({
  consentRecordRepository: { deleteAllByPatient: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/shared/lib/blob-client', () => ({ blobClient: { remove: vi.fn() } }));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { consentRecordRepository } from '@/features/data-protection/repository/consent-record.repository';
import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { ratingRepository } from '@/features/rating/repository/rating.repository';
import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { blobClient } from '@/shared/lib/blob-client';

import { deletePatientService } from './delete-patient.service';

const patients = vi.mocked(patientRepository);
const plans = vi.mocked(carePlanRepository);
const reminders = vi.mocked(reminderOccurrenceRepository);
const ratings = vi.mocked(ratingRepository);
const photos = vi.mocked(patientPhotoRepository);
const accessTokens = vi.mocked(patientAccessTokenRepository);
const portalLinks = vi.mocked(patientPortalLinkRepository);
const consents = vi.mocked(consentRecordRepository);
const blob = vi.mocked(blobClient);

const CLINIC = '507f1f77bcf86cd799439011';
const PATIENT = '507f1f77bcf86cd799439022';

beforeEach(() => {
  vi.clearAllMocks();
  patients.findById.mockResolvedValue({ _id: PATIENT } as never);
  patients.deleteById.mockResolvedValue(true);
  photos.findByPatient.mockResolvedValue([]);
  photos.deleteAllByPatient.mockResolvedValue(0);
});

describe('deletePatientService — tenancy', () => {
  /*
    The whole reason every call carries `clinicId`: this endpoint erases a patient outright, so an
    id belonging to another clinic must find nothing rather than delete something.
  */
  it('404s on a patient belonging to another clinic, touching nothing', async () => {
    patients.findById.mockResolvedValue(null);

    const result = await deletePatientService(CLINIC, PATIENT);

    expect(result).toEqual({ data: { error: 'NOT_FOUND' }, status: 404 });
    expect(patients.deleteById).not.toHaveBeenCalled();
    expect(reminders.deleteAllByPatient).not.toHaveBeenCalled();
  });

  it('scopes every delete by clinic as well as patient', async () => {
    await deletePatientService(CLINIC, PATIENT);

    for (const call of [
      reminders.deleteAllByPatient,
      plans.deleteAllByPatient,
      ratings.deleteAllByPatient,
      accessTokens.deleteAllByPatient,
      portalLinks.deleteAllByPatient,
      consents.deleteAllByPatient,
    ]) {
      expect(call).toHaveBeenCalledWith(PATIENT, CLINIC);
    }
    expect(patients.deleteById).toHaveBeenCalledWith(PATIENT, CLINIC);
  });
});

describe('deletePatientService — what a full erasure removes', () => {
  /** Archiving only set a flag. A hidden record is still a held record. */
  it('removes the patient row itself rather than flagging it', async () => {
    const { data, status } = await deletePatientService(CLINIC, PATIENT);

    expect(status).toBe(200);
    expect(patients.deleteById).toHaveBeenCalledWith(PATIENT, CLINIC);
    expect('deleted' in data && data.deleted).toBe(true);
  });

  /*
    Two copies, two deletes. The rows go with the clinical record; the bytes live in Blob and would
    otherwise outlive the patient — post-operative photographs belonging to no record at all.
  */
  it('removes the stored photograph bytes, not only the rows', async () => {
    photos.findByPatient.mockResolvedValue([
      { pathname: 'p/1.jpg' },
      { pathname: 'p/2.jpg' },
    ] as never);

    await deletePatientService(CLINIC, PATIENT);

    expect(blob.remove).toHaveBeenCalledWith('p/1.jpg');
    expect(blob.remove).toHaveBeenCalledWith('p/2.jpg');
    expect(photos.deleteAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
  });

  /** The rating rows are what the public boards aggregate, so removing them is the whole update. */
  it('removes the ratings, taking the patient off the public boards', async () => {
    await deletePatientService(CLINIC, PATIENT);

    expect(ratings.deleteAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
  });

  /*
    The dispatch sweep reads occurrences with no clinic scope, so clearing them first stops a run
    picking up reminders for a patient who is halfway deleted.
  */
  it('clears the reminders before the patient row', async () => {
    await deletePatientService(CLINIC, PATIENT);

    const [clearedReminders] = reminders.deleteAllByPatient.mock.invocationCallOrder;
    const [deletedPatient] = patients.deleteById.mock.invocationCallOrder;

    expect(clearedReminders).toBeLessThan(deletedPatient);
  });
});
