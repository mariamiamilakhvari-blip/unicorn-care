 
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findAllByClinic: vi.fn() },
}));

import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import {
  checkPatientSeat,
  getSubscriptionService,
  resolveStatus,
} from '@/features/clinic/service/subscription.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { STANDARD_PATIENT_LIMIT, TRIAL_PATIENT_LIMIT } from '@/shared/const/plan.const';

const CLINIC_ID = '507f1f77bcf86cd799439011';

const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);

type ClinicOverrides = Partial<{
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  planRenewsAt: Date | null;
}>;

function clinicDoc(overrides: ClinicOverrides = {}) {
  return {
    _id: CLINIC_ID,
    plan: 'trial',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 3 * 86_400_000),
    planRenewsAt: null,
    timezone: 'Asia/Tbilisi',
    ...overrides,
  } as never;
}

/** `count` active patients, plus one archived to prove archived rows never occupy a seat. */
function roster(count: number) {
  const items = Array.from({ length: count }, (_, index) => ({
    _id: `active-${index}`,
    isArchived: false,
  }));
  items.push({ _id: 'archived', isArchived: true } as never);
  return { items, total: items.length } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  clinics.findById.mockResolvedValue(clinicDoc());
  patients.findAllByClinic.mockResolvedValue(roster(0));
  clinics.updateById.mockResolvedValue(true);
});

describe('resolveStatus', () => {
  it('keeps a trial alive before its end date', () => {
    const clinic = clinicDoc({ trialEndsAt: new Date(Date.now() + 86_400_000) });
    expect(resolveStatus(clinic, new Date())).toBe('trialing');
  });

  /** Derived on read, so an expired trial cannot survive because no scheduled job ran. */
  it('expires a trial once the date has passed, with no job required', () => {
    const clinic = clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) });
    expect(resolveStatus(clinic, new Date())).toBe('expired');
  });

  /**
   * Regression: clinics created before subscriptions existed have no `subscriptionStatus`, and
   * Mongoose defaults do not backfill existing rows. Reading it raw made `canWrite` false and
   * locked every one of them out of adding patients.
   */
  it('grandfathers a clinic that predates the subscription fields', () => {
    const legacy = { _id: CLINIC_ID, timezone: 'Asia/Tbilisi' } as never;
    expect(resolveStatus(legacy, new Date())).toBe('trialing');
  });

  it('never downgrades a paid subscription', () => {
    const clinic = clinicDoc({
      subscriptionStatus: 'active',
      plan: 'standard',
      trialEndsAt: new Date(Date.now() - 86_400_000),
    });
    expect(resolveStatus(clinic, new Date())).toBe('active');
  });
});

describe('checkPatientSeat — limits', () => {
  it('allows a trial clinic below the 5-patient limit', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT - 1));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });

  it('refuses once the trial limit is reached', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'PATIENT_LIMIT_REACHED',
    });
  });

  it('refuses a Standard clinic at 50 active patients', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'active' })
    );
    patients.findAllByClinic.mockResolvedValue(roster(STANDARD_PATIENT_LIMIT));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'PATIENT_LIMIT_REACHED',
    });
  });

  it('never limits Premium', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'premium', subscriptionStatus: 'active' })
    );
    patients.findAllByClinic.mockResolvedValue(roster(5000));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });

  /** Archiving is how a clinic frees a seat, so archived rows must not be counted. */
  it('does not count archived patients against the limit', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT - 1));
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({ ok: true });
  });
});

describe('checkPatientSeat — subscription state', () => {
  it('refuses when the trial has expired, before counting anything', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) })
    );

    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'SUBSCRIPTION_INACTIVE',
    });
    expect(patients.findAllByClinic).not.toHaveBeenCalled();
  });

  it('refuses a past_due subscription', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'past_due' })
    );
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'SUBSCRIPTION_INACTIVE',
    });
  });

  it('refuses a cancelled subscription', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'standard', subscriptionStatus: 'cancelled' })
    );
    expect(await checkPatientSeat(CLINIC_ID)).toEqual({
      ok: false,
      reason: 'SUBSCRIPTION_INACTIVE',
    });
  });
});

describe('getSubscriptionService', () => {
  it('reports usage against the plan limit', async () => {
    patients.findAllByClinic.mockResolvedValue(roster(3));

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({
      plan: 'trial',
      status: 'trialing',
      activePatients: 3,
      patientLimit: TRIAL_PATIENT_LIMIT,
      isAtPatientLimit: false,
      canWrite: true,
    });
  });

  it('flags the limit and blocks writes once the trial expires', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ trialEndsAt: new Date(Date.now() - 86_400_000) })
    );
    patients.findAllByClinic.mockResolvedValue(roster(TRIAL_PATIENT_LIMIT));

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ status: 'expired', isAtPatientLimit: true, canWrite: false });
  });

  it('reports Premium as unlimited rather than at a limit', async () => {
    clinics.findById.mockResolvedValue(
      clinicDoc({ plan: 'premium', subscriptionStatus: 'active' })
    );
    patients.findAllByClinic.mockResolvedValue(roster(500));

    const { data } = await getSubscriptionService(CLINIC_ID);

    expect(data).toMatchObject({ patientLimit: null, isAtPatientLimit: false });
  });
});
