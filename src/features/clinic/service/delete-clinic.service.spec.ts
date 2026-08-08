import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn(), deleteById: vi.fn() },
}));
vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { deleteAllByClinic: vi.fn() },
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
vi.mock('@/features/auth/repository/user.repository', () => ({
  userRepository: { deleteAllByClinic: vi.fn() },
}));
vi.mock('@/shared/lib/dodo-client', () => ({ dodoClient: { cancelSubscription: vi.fn() } }));

import { userRepository } from '@/features/auth/repository/user.repository';
import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { dodoClient } from '@/shared/lib/dodo-client';

import { deleteClinicService } from './delete-clinic.service';

const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);
const procedures = vi.mocked(procedureRepository);
const plans = vi.mocked(carePlanRepository);
const reminders = vi.mocked(reminderOccurrenceRepository);
const guides = vi.mocked(recoveryGuideRepository);
const users = vi.mocked(userRepository);
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
  dodo.cancelSubscription.mockResolvedValue({ ok: true });
  for (const repo of [patients, procedures, plans, reminders, guides, users]) {
    repo.deleteAllByClinic.mockResolvedValue(0);
  }
});

describe('deleteClinicService', () => {
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
