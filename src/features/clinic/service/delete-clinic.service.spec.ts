import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn(), deleteById: vi.fn() },
}));
vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { deleteAllByClinic: vi.fn(), findAllByClinic: vi.fn() },
}));
vi.mock('@/features/patient/repository/patient-access-token.repository', () => ({
  patientAccessTokenRepository: { deleteAllByClinic: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/patient/repository/patient-portal-link.repository', () => ({
  patientPortalLinkRepository: { deleteAllByClinic: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/recovery-guide/repository/symptom-report.repository', () => ({
  symptomReportRepository: { deleteAllByClinic: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/recovery-log/repository/photo-access-event.repository', () => ({
  photoAccessEventRepository: { deleteAllByClinic: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/data-protection/repository/consent-record.repository', () => ({
  consentRecordRepository: { deleteAllByClinic: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/data-protection/repository/data-request.repository', () => ({
  dataRequestRepository: { deleteAllByClinic: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/notifications/repository/push-subscription.repository', () => ({
  pushSubscriptionRepository: { deleteAllByPatients: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/auth/repository/password-reset-token.repository', () => ({
  passwordResetTokenRepository: { deleteAllByUsers: vi.fn().mockResolvedValue(0) },
}));
vi.mock('@/features/procedure/repository/procedure.repository', () => ({
  procedureRepository: { deleteAllByClinic: vi.fn() },
}));
vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { deleteAllByClinic: vi.fn() },
}));
vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: { deleteAllByClinic: vi.fn() },
}));
vi.mock('@/features/notifications/repository/email-event.repository', () => ({
  emailEventRepository: { deleteAllByClinic: vi.fn().mockResolvedValue(0) },
}));

vi.mock('@/features/recovery-guide/repository/recovery-guide.repository', () => ({
  recoveryGuideRepository: { deleteAllByClinic: vi.fn() },
}));
vi.mock('@/features/rating/repository/rating.repository', () => ({
  ratingRepository: { deleteAllByClinic: vi.fn() },
}));
vi.mock('@/features/recovery-log/repository/patient-photo.repository', () => ({
  patientPhotoRepository: { findAllByClinic: vi.fn(), deleteAllByClinic: vi.fn() },
}));
vi.mock('@/features/recovery-log/repository/recovery-log.repository', () => ({
  recoveryLogRepository: { deleteAllByClinic: vi.fn() },
}));
vi.mock('@/shared/lib/blob-client', () => ({ blobClient: { remove: vi.fn() } }));
vi.mock('@/features/auth/repository/user.repository', () => ({
  userRepository: { deleteAllByClinic: vi.fn(), findAllByClinic: vi.fn() },
}));
vi.mock('@/shared/lib/dodo-client', () => ({ dodoClient: { cancelSubscription: vi.fn() } }));

import { passwordResetTokenRepository } from '@/features/auth/repository/password-reset-token.repository';
import { userRepository } from '@/features/auth/repository/user.repository';
import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { consentRecordRepository } from '@/features/data-protection/repository/consent-record.repository';
import { dataRequestRepository } from '@/features/data-protection/repository/data-request.repository';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { ratingRepository } from '@/features/rating/repository/rating.repository';
import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { symptomReportRepository } from '@/features/recovery-guide/repository/symptom-report.repository';
import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { photoAccessEventRepository } from '@/features/recovery-log/repository/photo-access-event.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { blobClient } from '@/shared/lib/blob-client';
import { dodoClient } from '@/shared/lib/dodo-client';

import { deleteClinicService } from './delete-clinic.service';

const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);
const procedures = vi.mocked(procedureRepository);
const plans = vi.mocked(carePlanRepository);
const reminders = vi.mocked(reminderOccurrenceRepository);
const guides = vi.mocked(recoveryGuideRepository);
const users = vi.mocked(userRepository);
const ratings = vi.mocked(ratingRepository);
const accessTokens = vi.mocked(patientAccessTokenRepository);
const portalLinks = vi.mocked(patientPortalLinkRepository);
const symptomReports = vi.mocked(symptomReportRepository);
const photoAccess = vi.mocked(photoAccessEventRepository);
const consents = vi.mocked(consentRecordRepository);
const dataRequests = vi.mocked(dataRequestRepository);
const pushSubs = vi.mocked(pushSubscriptionRepository);
const resetTokens = vi.mocked(passwordResetTokenRepository);
const photos = vi.mocked(patientPhotoRepository);
const logs = vi.mocked(recoveryLogRepository);
const blob = vi.mocked(blobClient);
const dodo = vi.mocked(dodoClient);

const CLINIC_ID = '507f1f77bcf86cd799439011';

function clinicDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CLINIC_ID,
    name: 'Gold Esthetic',
    dodoSubscriptionId: 'sub_1',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  clinics.findById.mockResolvedValue(clinicDoc());
  clinics.deleteById.mockResolvedValue(true);
  // The ids the cascade captures up front, for the two collections that carry no `clinicId`.
  patients.findAllByClinic.mockResolvedValue({ items: [], total: 0 } as never);
  users.findAllByClinic.mockResolvedValue([] as never);
  dodo.cancelSubscription.mockResolvedValue({ ok: true });
  for (const repo of [patients, procedures, plans, reminders, guides, users]) {
    repo.deleteAllByClinic.mockResolvedValue(0);
  }
  logs.deleteAllByClinic.mockResolvedValue(0);
  photos.findAllByClinic.mockResolvedValue([]);
  photos.deleteAllByClinic.mockResolvedValue(0);
  blob.remove.mockResolvedValue(true);
});

describe('deleteClinicService', () => {
  /**
   * Photographs exist twice: a row, and the bytes in Blob. Deleting only the row would leave
   * post-operative photographs of a patient's body in storage, belonging to an account that no
   * longer exists and reachable by nothing that could ever delete them.
   */
  it('removes the stored photograph bytes, not only the rows', async () => {
    photos.findAllByClinic.mockResolvedValue([
      { pathname: 'patients/c1/p1/day3.jpg' },
      { pathname: 'patients/c1/p1/day7.jpg' },
    ] as never);

    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(blob.remove).toHaveBeenCalledWith('patients/c1/p1/day3.jpg');
    expect(blob.remove).toHaveBeenCalledWith('patients/c1/p1/day7.jpg');
    expect(photos.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
  });

  it('cancels the subscription and purges every collection the clinic owns', async () => {
    const { status, data } = await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(status).toBe(200);
    expect(data).toMatchObject({ deleted: true, subscriptionCancelled: true });
    expect(dodo.cancelSubscription).toHaveBeenCalledWith('sub_1');
    for (const repo of [patients, procedures, plans, reminders, guides, users]) {
      expect(repo.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
    }
    expect(clinics.deleteById).toHaveBeenCalledWith(CLINIC_ID);
  });

  /**
   * The ordering that matters. Deleting first and cancelling after would, on a failed cancel, leave
   * an owner with no account, no way back in, and a subscription still charging them.
   */
  it('cancels billing before deleting anything', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    const [cancelOrder] = dodo.cancelSubscription.mock.invocationCallOrder;
    const [patientOrder] = patients.deleteAllByClinic.mock.invocationCallOrder;
    const [clinicOrder] = clinics.deleteById.mock.invocationCallOrder;

    expect(cancelOrder).toBeLessThan(patientOrder);
    expect(patientOrder).toBeLessThan(clinicOrder);
  });

  it('deletes nothing at all when the subscription cannot be cancelled', async () => {
    dodo.cancelSubscription.mockResolvedValue({ ok: false, statusCode: 502, message: 'boom' });

    const { status, data } = await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(status).toBe(502);
    expect(data).toEqual({ error: 'SUBSCRIPTION_CANCEL_FAILED' });
    expect(patients.deleteAllByClinic).not.toHaveBeenCalled();
    expect(clinics.deleteById).not.toHaveBeenCalled();
  });

  it('refuses and deletes nothing when the typed name does not match', async () => {
    const { status, data } = await deleteClinicService(CLINIC_ID, 'gold esthetic');

    expect(status).toBe(422);
    expect(data).toEqual({ error: 'CONFIRMATION_MISMATCH' });
    expect(dodo.cancelSubscription).not.toHaveBeenCalled();
    expect(patients.deleteAllByClinic).not.toHaveBeenCalled();
  });

  it('tolerates surrounding whitespace in the confirmation', async () => {
    const { status } = await deleteClinicService(CLINIC_ID, '  Gold Esthetic  ');

    expect(status).toBe(200);
  });

  it('deletes a clinic that never subscribed without calling the billing provider', async () => {
    clinics.findById.mockResolvedValue(clinicDoc({ dodoSubscriptionId: null }));

    const { status, data } = await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(status).toBe(200);
    expect(data).toMatchObject({ subscriptionCancelled: false });
    expect(dodo.cancelSubscription).not.toHaveBeenCalled();
    expect(clinics.deleteById).toHaveBeenCalled();
  });

  it('404s for a clinic that does not exist', async () => {
    clinics.findById.mockResolvedValue(null);

    const { status } = await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(status).toBe(404);
    expect(clinics.deleteById).not.toHaveBeenCalled();
  });
});

/**
 * The cascade used to reach ten collections and leave nine behind, several holding patient health
 * data: portal credentials, symptom reports, the photograph access log, the consent record, the
 * data requests, and — because neither carries a `clinicId` at all — every push endpoint and
 * password-reset token belonging to the accounts being deleted.
 *
 * `consentRecordRepository` and `dataRequestRepository` both already had a `deleteAllByClinic`
 * that nothing ever called, which is the easiest kind of gap to miss: the method exists, so a
 * search for one finds it.
 */
describe('deleteClinicService — the collections that were being orphaned', () => {
  // `CLINIC_ID` and the confirmation name come from the fixtures at the top of this file — a
  // mismatched name is a 422 and the service returns before deleting anything.
  const PATIENT_ID = '507f1f77bcf86cd799439022';
  const STAFF_ID = '507f1f77bcf86cd799439033';

  beforeEach(() => {
    patients.findAllByClinic.mockResolvedValue({
      items: [{ _id: { toString: () => PATIENT_ID } }],
      total: 1,
    } as never);
    users.findAllByClinic.mockResolvedValue([{ _id: { toString: () => STAFF_ID } }] as never);
  });

  it('purges the portal credentials', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(accessTokens.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
    expect(portalLinks.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
  });

  it('purges the patient-reported health data and its access log', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(symptomReports.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
    expect(photoAccess.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
  });

  it('purges the data-protection record, which had a delete nobody called', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(consents.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
    expect(dataRequests.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
  });

  /*
    The two the clinic-scoped cascade structurally could not see. Both are resolved from ids read
    before their owners are deleted, so this also pins the ordering: read first, delete after.
  */
  it('purges push endpoints by patient id, since they carry no clinic', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(pushSubs.deleteAllByPatients).toHaveBeenCalledWith([PATIENT_ID]);
  });

  it('purges reset tokens by user id, since they carry no clinic', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(resetTokens.deleteAllByUsers).toHaveBeenCalledWith([STAFF_ID]);
  });

  it('reads the patient and staff ids before deleting the rows that carry them', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    const [readPatients] = patients.findAllByClinic.mock.invocationCallOrder;
    const [deletedPatients] = patients.deleteAllByClinic.mock.invocationCallOrder;
    const [readStaff] = users.findAllByClinic.mock.invocationCallOrder;
    const [deletedStaff] = users.deleteAllByClinic.mock.invocationCallOrder;

    expect(readPatients).toBeLessThan(deletedPatients);
    expect(readStaff).toBeLessThan(deletedStaff);
  });

  /** Ratings go with the clinic, which is what takes it off the public boards. */
  it('purges the ratings behind the public leaderboards', async () => {
    await deleteClinicService(CLINIC_ID, 'Gold Esthetic');

    expect(ratings.deleteAllByClinic).toHaveBeenCalledWith(CLINIC_ID);
  });
});
