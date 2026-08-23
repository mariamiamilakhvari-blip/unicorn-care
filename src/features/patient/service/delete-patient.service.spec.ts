import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn(), deleteById: vi.fn() },
}));
vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: {
    findAllByPatient: vi.fn().mockResolvedValue([]),
    deleteAllByPatient: vi.fn().mockResolvedValue(0),
  },
}));
vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    deleteAllByPatient: vi.fn().mockResolvedValue(0),
    deleteAllByCarePlan: vi.fn().mockResolvedValue(0),
  },
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
const NAME = 'Lika Beridze';

beforeEach(() => {
  vi.clearAllMocks();
  patients.findById.mockResolvedValue({ _id: PATIENT, firstName: 'Lika', lastName: 'Beridze' } as never);
  patients.deleteById.mockResolvedValue(true);
  photos.findByPatient.mockResolvedValue([]);
  photos.deleteAllByPatient.mockResolvedValue(0);
  plans.findAllByPatient.mockResolvedValue([]);
  plans.deleteAllByPatient.mockResolvedValue(0);
  reminders.deleteAllByPatient.mockResolvedValue(0);
  reminders.deleteAllByCarePlan.mockResolvedValue(0);
});

/** A plan as the cascade reads it: only its id is used. */
const plan = (id: string) => ({ _id: { toString: () => id } });

describe('deletePatientService — tenancy', () => {
  /*
    The whole reason every call carries `clinicId`: this endpoint erases a patient outright, so an
    id belonging to another clinic must find nothing rather than delete something.
  */
  it('404s on a patient belonging to another clinic, touching nothing', async () => {
    patients.findById.mockResolvedValue(null);

    const result = await deletePatientService(CLINIC, PATIENT, NAME);

    expect(result).toEqual({ data: { error: 'NOT_FOUND' }, status: 404 });
    expect(patients.deleteById).not.toHaveBeenCalled();
    expect(reminders.deleteAllByPatient).not.toHaveBeenCalled();
  });

  it('scopes every delete by clinic as well as patient', async () => {
    await deletePatientService(CLINIC, PATIENT, NAME);

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
    const { data, status } = await deletePatientService(CLINIC, PATIENT, NAME);

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

    await deletePatientService(CLINIC, PATIENT, NAME);

    expect(blob.remove).toHaveBeenCalledWith('p/1.jpg');
    expect(blob.remove).toHaveBeenCalledWith('p/2.jpg');
    expect(photos.deleteAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
  });

  /** The rating rows are what the public boards aggregate, so removing them is the whole update. */
  it('removes the ratings, taking the patient off the public boards', async () => {
    await deletePatientService(CLINIC, PATIENT, NAME);

    expect(ratings.deleteAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
  });

  /*
    The dispatch sweep reads occurrences with no clinic scope, so clearing them first stops a run
    picking up reminders for a patient who is halfway deleted.
  */
  it('clears the reminders before the patient row', async () => {
    await deletePatientService(CLINIC, PATIENT, NAME);

    const [clearedReminders] = reminders.deleteAllByPatient.mock.invocationCallOrder;
    const [deletedPatient] = patients.deleteById.mock.invocationCallOrder;

    expect(clearedReminders).toBeLessThan(deletedPatient);
  });
});

/**
 * Erasure is unconditional. A patient still mid-course is not an edge case to be refused — it is
 * the case the right exists for, since a withdrawal takes effect when it is made rather than when
 * the course happens to finish.
 */
describe('deletePatientService — a patient still in active care', () => {
  const ACTIVE = '507f1f77bcf86cd799439033';
  const FINISHED = '507f1f77bcf86cd799439044';

  beforeEach(() => {
    plans.findAllByPatient.mockResolvedValue([plan(ACTIVE), plan(FINISHED)] as never);
    plans.deleteAllByPatient.mockResolvedValue(2);
    reminders.deleteAllByPatient.mockResolvedValue(40);
    reminders.deleteAllByCarePlan.mockResolvedValue(1);
    ratings.deleteAllByPatient.mockResolvedValue(3);
  });

  it('erases the patient with an active plan, pending reminders and published ratings', async () => {
    const result = await deletePatientService(CLINIC, PATIENT, NAME);

    expect(result.status).toBe(200);
    expect(plans.deleteAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
    expect(ratings.deleteAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
    expect(patients.deleteById).toHaveBeenCalledWith(PATIENT, CLINIC);
  });

  /** Every plan, whatever its status — a finished course leaves rows behind like a running one. */
  it('reads every plan, not only the active ones', async () => {
    await deletePatientService(CLINIC, PATIENT, NAME);

    expect(plans.findAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
    expect(reminders.deleteAllByCarePlan).toHaveBeenCalledTimes(2);
  });

  /*
    The second sweep. An occurrence carries `patientId` and `carePlanId` independently, so a row
    whose patient reference is stale survives the first filter and would then sit in the dispatch
    queue pointing at a patient who no longer exists.
  */
  it('sweeps occurrences by each care plan as well as by the patient', async () => {
    await deletePatientService(CLINIC, PATIENT, NAME);

    expect(reminders.deleteAllByPatient).toHaveBeenCalledWith(PATIENT, CLINIC);
    expect(reminders.deleteAllByCarePlan).toHaveBeenCalledWith(ACTIVE, CLINIC);
    expect(reminders.deleteAllByCarePlan).toHaveBeenCalledWith(FINISHED, CLINIC);
  });

  it('counts both sweeps in what it reports back', async () => {
    const { data } = await deletePatientService(CLINIC, PATIENT, NAME);

    expect(data).toEqual({
      deleted: true,
      counts: { procedures: 0, carePlans: 2, reminders: 42, ratings: 3, photos: 0 },
    });
  });

  /* The plans are gone by the end, so their ids have to be in hand before anything is removed. */
  it('reads the plans before deleting them', async () => {
    await deletePatientService(CLINIC, PATIENT, NAME);

    const [read] = plans.findAllByPatient.mock.invocationCallOrder;
    const [sweptByPlan] = reminders.deleteAllByCarePlan.mock.invocationCallOrder;
    const [deleted] = plans.deleteAllByPatient.mock.invocationCallOrder;

    expect(read).toBeLessThan(sweptByPlan);
    expect(sweptByPlan).toBeLessThan(deleted);
  });
});

/**
 * The typed gate. A confirm dialog is one click, and this destroys a clinical record outright —
 * the plans, the adherence history, the photographs. Account deletion has always been guarded this
 * way; per-patient erasure is the same act at a smaller scale.
 */
describe('deletePatientService — the typed confirmation', () => {
  it('refuses a mismatched name with 422 and deletes nothing', async () => {
    const result = await deletePatientService(CLINIC, PATIENT, 'Lika Beridz');

    expect(result).toEqual({ data: { error: 'CONFIRMATION_MISMATCH' }, status: 422 });
    expect(patients.deleteById).not.toHaveBeenCalled();
    expect(reminders.deleteAllByPatient).not.toHaveBeenCalled();
    expect(blob.remove).not.toHaveBeenCalled();
  });

  it('accepts surrounding whitespace, since that is a paste artefact and not a mistake', async () => {
    const { status } = await deletePatientService(CLINIC, PATIENT, '  Lika Beridze  ');

    expect(status).toBe(200);
    expect(patients.deleteById).toHaveBeenCalledWith(PATIENT, CLINIC);
  });

  /*
    The failure this was reported as. Nothing trimmed the name fields at intake, so a record could
    hold `"Lika "` and render a full name whose doubled space the browser collapses to one. The
    clinic typed exactly what the screen showed, the comparison failed on a character that was
    never visible, and the button stayed disabled with nothing to explain why.
  */
  it('accepts the visible name when the record carries a doubled space', async () => {
    patients.findById.mockResolvedValue({
      _id: PATIENT,
      firstName: 'Lika ',
      lastName: 'Beridze',
    } as never);

    const { status } = await deletePatientService(CLINIC, PATIENT, 'Lika Beridze');

    expect(status).toBe(200);
    expect(patients.deleteById).toHaveBeenCalledWith(PATIENT, CLINIC);
  });

  /** Case is the one thing not forgiven: it is the difference between reading and skimming. */
  it('refuses a case mismatch', async () => {
    const { status } = await deletePatientService(CLINIC, PATIENT, 'lika beridze');

    expect(status).toBe(422);
    expect(patients.deleteById).not.toHaveBeenCalled();
  });

  /** The name is read off the record, never taken from the caller. */
  it('checks the confirmation against the stored name, not a supplied one', async () => {
    patients.findById.mockResolvedValue({
      _id: PATIENT,
      firstName: 'Nino',
      lastName: 'Kechakmadze',
    } as never);

    expect((await deletePatientService(CLINIC, PATIENT, NAME)).status).toBe(422);
    expect((await deletePatientService(CLINIC, PATIENT, 'Nino Kechakmadze')).status).toBe(200);
  });
});
