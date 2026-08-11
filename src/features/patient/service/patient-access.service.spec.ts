import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/patient/repository/patient-access-token.repository', () => ({
  patientAccessTokenRepository: {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    revokeAllForPatient: vi.fn(),
    touchLastUsed: vi.fn(),
  },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));

vi.mock('@/features/notifications/repository/push-subscription.repository', () => ({
  pushSubscriptionRepository: { deactivateAllForPatient: vi.fn() },
}));

import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import {
  issueTokenService,
  redeemTokenService,
  revokeAccessService,
} from '@/features/patient/service/patient-access.service';
import { hashPassword } from '@/shared/utils/password';

const tokens = vi.mocked(patientAccessTokenRepository);
const patients = vi.mocked(patientRepository);
const pushSubscriptions = vi.mocked(pushSubscriptionRepository);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const PATIENT_ID = '507f1f77bcf86cd799439033';
const RAW_TOKEN = 'DhVsF3n0m1Rk2QpXyZ7aB9cD4eF6gH8iJkLmNoPqRsT';

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'tok1' },
    patientId: { toString: () => PATIENT_ID },
    clinicId: { toString: () => CLINIC_ID },
    tokenHash: hashPassword(RAW_TOKEN),
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  patients.findById.mockResolvedValue({ locale: 'ka' } as never);
  tokens.create.mockResolvedValue('newtok');
  tokens.revokeAllForPatient.mockResolvedValue(0);
  tokens.touchLastUsed.mockResolvedValue(true);
  pushSubscriptions.deactivateAllForPatient.mockResolvedValue(0);
});

describe('issueTokenService', () => {
  it('404s for a patient outside the calling clinic', async () => {
    patients.findById.mockResolvedValue(null);
    expect((await issueTokenService(CLINIC_ID, PATIENT_ID)).status).toBe(404);
  });

  /*
    The guarantee the whole feature rests on: a link a patient already has must keep working for
    the length of their rehabilitation. Issuing is additive, so nothing a clinic does for one
    patient can invalidate the email that patient is still using.
  */
  it('does not revoke prior links, so an email already sent keeps working', async () => {
    await issueTokenService(CLINIC_ID, PATIENT_ID);
    expect(tokens.revokeAllForPatient).not.toHaveBeenCalled();
  });

  it('writes no expiry, so the new link cannot lapse on its own', async () => {
    await issueTokenService(CLINIC_ID, PATIENT_ID);

    const written = tokens.create.mock.calls[0][0];
    expect(written).not.toHaveProperty('expiresAt');
    expect(written.revokedAt).toBeNull();
  });

  it('stores only the hash, never the raw token that goes in the URL', async () => {
    const { data } = await issueTokenService(CLINIC_ID, PATIENT_ID);

    const raw = (data as { url: string }).url.split('/').pop() as string;
    expect(tokens.create.mock.calls[0][0].tokenHash).toBe(hashPassword(raw));
    expect(tokens.create.mock.calls[0][0].tokenHash).not.toBe(raw);
  });
});

describe('redeemTokenService', () => {
  it('accepts a valid token', async () => {
    tokens.findByTokenHash.mockResolvedValue(tokenRow() as never);

    const { status, data } = await redeemTokenService(RAW_TOKEN);
    expect(status).toBe(200);
    expect(data).toEqual({ patientId: PATIENT_ID, clinicId: CLINIC_ID, locale: 'ka' });
  });

  /*
    Rows written before links became permanent still carry the field. Nothing reads it any more,
    and a patient holding one of those links must not be turned away.
  */
  it('accepts a token carrying a long-past expiresAt from before links were permanent', async () => {
    tokens.findByTokenHash.mockResolvedValue(
      tokenRow({ expiresAt: new Date('2020-01-01T00:00:00Z') }) as never
    );

    expect((await redeemTokenService(RAW_TOKEN)).status).toBe(200);
  });

  it('rejects a revoked token, the only thing that still ends a link', async () => {
    tokens.findByTokenHash.mockResolvedValue(
      tokenRow({ revokedAt: new Date('2026-01-01T00:00:00Z') }) as never
    );

    expect((await redeemTokenService(RAW_TOKEN)).status).toBe(401);
  });

  it('rejects an unknown token with the same 401, so the endpoint tells nothing apart', async () => {
    tokens.findByTokenHash.mockResolvedValue(null);
    expect((await redeemTokenService(RAW_TOKEN)).status).toBe(401);
  });
});

describe('revokeAccessService', () => {
  /*
    Links accumulate now that issuing never clears them, which makes this the only control a
    clinic has over a leak — and it has to reach every outstanding link, not just the newest.
  */
  it('revokes every live link for the patient, not only the most recent', async () => {
    tokens.revokeAllForPatient.mockResolvedValue(3);

    const { data } = await revokeAccessService(CLINIC_ID, PATIENT_ID);
    expect(tokens.revokeAllForPatient).toHaveBeenCalledWith(
      PATIENT_ID,
      CLINIC_ID,
      expect.any(Date)
    );
    expect((data as { revokedTokens: number }).revokedTokens).toBe(3);
  });

  it('deactivates push subscriptions too, so reminders stop with the access', async () => {
    await revokeAccessService(CLINIC_ID, PATIENT_ID);
    expect(pushSubscriptions.deactivateAllForPatient).toHaveBeenCalledWith(PATIENT_ID);
  });
});
