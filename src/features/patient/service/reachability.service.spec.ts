import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));
vi.mock('@/features/notifications/repository/push-subscription.repository', () => ({
  pushSubscriptionRepository: { findActiveByPatient: vi.fn() },
}));

import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { getPatientReachabilityService } from '@/features/patient/service/reachability.service';

const patients = vi.mocked(patientRepository);
const subscriptions = vi.mocked(pushSubscriptionRepository);

const PATIENT = '507f1f77bcf86cd799439011';
const CLINIC = '507f1f77bcf86cd799439022';

const patient = (over: Partial<PatientDocument> = {}): PatientDocument =>
  ({
    _id: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    email: 'nino@example.com',
    emailSuppressedAt: null,
    ...over,
  }) as PatientDocument;

const withPush = (n: number) =>
  subscriptions.findActiveByPatient.mockResolvedValue(
    Array.from({ length: n }, () => ({}) as never)
  );

const result = async () => (await getPatientReachabilityService(PATIENT, CLINIC)).data;

describe('getPatientReachabilityService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    patients.findById.mockResolvedValue(patient());
    withPush(0);
  });

  /**
   * Push needs a browser permission prompt most people decline, so email is the channel that
   * actually carries reminders. A patient with an address and no push is perfectly reachable and
   * must not be flagged — twelve of thirteen patients in production are exactly that.
   */
  it('treats an address with no push as reachable', async () => {
    expect(await result()).toMatchObject({ isReachable: true, hasEmail: true, hasPush: false });
  });

  it('treats push with no address as reachable', async () => {
    patients.findById.mockResolvedValue(patient({ email: '' }));
    withPush(1);

    expect(await result()).toMatchObject({ isReachable: true, reason: '' });
  });

  /** The state that prompted this: reminders generated and retired with nowhere to go. */
  it('reports no contact method when both channels are absent', async () => {
    patients.findById.mockResolvedValue(patient({ email: '' }));

    expect(await result()).toMatchObject({
      isReachable: false,
      reason: 'NO_CONTACT_METHOD',
    });
  });

  it('treats whitespace as no address, since a space is not somewhere to write to', async () => {
    patients.findById.mockResolvedValue(patient({ email: '   ' }));

    expect(await result()).toMatchObject({ hasEmail: false, isReachable: false });
  });

  it('handles an address field that was never set at all', async () => {
    patients.findById.mockResolvedValue(patient({ email: undefined }));

    expect(await result()).toMatchObject({ hasEmail: false, isReachable: false });
  });

  /**
   * Kept apart from a missing address because the remedy differs: a bounce is resolved with the
   * patient before anything can be sent there again, whereas a missing address is simply asked
   * for. A single "unreachable" would tell the clinic to do the wrong thing half the time.
   */
  describe('a suppressed address', () => {
    it('is not a way to reach anyone', async () => {
      patients.findById.mockResolvedValue(patient({ emailSuppressedAt: new Date() }));

      expect(await result()).toMatchObject({
        isReachable: false,
        emailSuppressed: true,
        reason: 'EMAIL_SUPPRESSED',
      });
    });

    it('still reports the address as present, because it is', async () => {
      patients.findById.mockResolvedValue(patient({ emailSuppressedAt: new Date() }));

      expect(await result()).toMatchObject({ hasEmail: true });
    });

    it('does not matter when push still works', async () => {
      patients.findById.mockResolvedValue(patient({ emailSuppressedAt: new Date() }));
      withPush(1);

      expect(await result()).toMatchObject({ isReachable: true, reason: '' });
    });
  });

  it('is a 404 for a patient outside this clinic', async () => {
    patients.findById.mockResolvedValue(null);

    const { status } = await getPatientReachabilityService(PATIENT, CLINIC);

    expect(status).toBe(404);
  });
});
