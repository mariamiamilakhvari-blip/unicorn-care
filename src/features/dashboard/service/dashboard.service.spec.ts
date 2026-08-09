import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findAllByClinic: vi.fn(), findWithUnusableEmail: vi.fn() },
}));
vi.mock('@/features/notifications/repository/push-subscription.repository', () => ({
  pushSubscriptionRepository: { findPatientIdsWithActive: vi.fn() },
}));

import { getClinicOverviewService } from '@/features/dashboard/service/dashboard.service';
import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';

const patients = vi.mocked(patientRepository);
const subscriptions = vi.mocked(pushSubscriptionRepository);

const CLINIC = '507f1f77bcf86cd799439022';

const patient = (id: string, over: Partial<PatientDocument> = {}): PatientDocument =>
  ({
    _id: new mongoose.Types.ObjectId(id),
    firstName: 'Nino',
    lastName: 'Beridze',
    emailSuppressedAt: null,
    ...over,
  }) as PatientDocument;

const A = '507f1f77bcf86cd799439001';
const B = '507f1f77bcf86cd799439002';

const unreachable = async () => {
  const { data } = await getClinicOverviewService(CLINIC);
  return 'unreachable' in data ? data.unreachable : [];
};

describe('getClinicOverviewService — unreachable patients', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    patients.findAllByClinic.mockResolvedValue({ items: [], total: 0 });
    patients.findWithUnusableEmail.mockResolvedValue([]);
    subscriptions.findPatientIdsWithActive.mockResolvedValue([]);
  });

  it('is empty when every patient has a usable address', async () => {
    expect(await unreachable()).toEqual([]);
  });

  it('skips the subscription lookup entirely when there are no candidates', async () => {
    // Most clinics are in this state, and it should cost them nothing.
    await getClinicOverviewService(CLINIC);

    expect(subscriptions.findPatientIdsWithActive).not.toHaveBeenCalled();
  });

  it('reports a patient with no address and no push', async () => {
    patients.findWithUnusableEmail.mockResolvedValue([patient(A)]);

    expect(await unreachable()).toEqual([
      { id: A, name: 'Nino Beridze', reason: 'NO_CONTACT_METHOD' },
    ]);
  });

  /**
   * Push is the rarer channel — it needs a permission prompt most people decline — but it is a
   * real one. A banner that warned about patients who are receiving every reminder would stop
   * being read, which costs more than it saves.
   */
  it('leaves out a patient who has push but no address', async () => {
    patients.findWithUnusableEmail.mockResolvedValue([patient(A)]);
    subscriptions.findPatientIdsWithActive.mockResolvedValue([A]);

    expect(await unreachable()).toEqual([]);
  });

  it('separates a suppressed address from a missing one', async () => {
    // Different remedies: one is asked for, the other resolved with the patient after a bounce.
    patients.findWithUnusableEmail.mockResolvedValue([
      patient(A),
      patient(B, { email: 'nino@example.com', emailSuppressedAt: new Date() }),
    ]);

    expect((await unreachable()).map(row => row.reason)).toEqual([
      'NO_CONTACT_METHOD',
      'EMAIL_SUPPRESSED',
    ]);
  });

  it('asks about every candidate in one query rather than one each', async () => {
    patients.findWithUnusableEmail.mockResolvedValue([patient(A), patient(B)]);

    await getClinicOverviewService(CLINIC);

    expect(subscriptions.findPatientIdsWithActive).toHaveBeenCalledTimes(1);
    expect(subscriptions.findPatientIdsWithActive).toHaveBeenCalledWith([A, B]);
  });

  it('still reports the ordinary overview alongside it', async () => {
    patients.findAllByClinic.mockResolvedValue({
      items: [patient(A)],
      total: 13,
    });

    const { data } = await getClinicOverviewService(CLINIC);

    expect(data).toMatchObject({ patientCount: 13 });
  });
});
