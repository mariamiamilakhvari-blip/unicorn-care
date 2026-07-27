/* eslint-disable import/order -- vi.mock is hoisted above imports, so the mocks must be declared first. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

vi.mock('@/features/patient/repository/patient-access-token.repository', () => ({
  patientAccessTokenRepository: { findByTokenHash: vi.fn() },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));

import { cookies } from 'next/headers';

import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PATIENT_COOKIE_NAME } from '@/shared/const/routes.const';
import { patientGuard, PatientGuard } from '@/shared/lib/patient-guard';
import { hashPassword } from '@/shared/utils/password';

const mockCookies = vi.mocked(cookies);
const mockTokenRepo = vi.mocked(patientAccessTokenRepository);
const mockPatientRepo = vi.mocked(patientRepository);

const RAW_TOKEN = 'DhVsF3n0m1Rk2QpXyZ7aB9cD4eF6gH8iJkLmNoPqRsT';
const CLINIC_ID = '507f1f77bcf86cd799439011';
const PATIENT_ID = '507f1f77bcf86cd799439033';

function setCookie(value?: string) {
  mockCookies.mockResolvedValueOnce({
    get: (name: string) => (name === PATIENT_COOKIE_NAME && value ? { value } : undefined),
  } as never);
}

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'tok1' },
    patientId: { toString: () => PATIENT_ID },
    clinicId: { toString: () => CLINIC_ID },
    tokenHash: hashPassword(RAW_TOKEN),
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

describe('patientGuard.requirePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves the patient session from a valid cookie', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({ locale: 'ka' } as never);

    expect(await patientGuard.requirePatient()).toEqual({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      locale: 'ka',
    });
  });

  it('looks the token up by its SHA-256 hash, never the raw value', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({ locale: 'en' } as never);

    await patientGuard.requirePatient();
    expect(mockTokenRepo.findByTokenHash).toHaveBeenCalledWith(hashPassword(RAW_TOKEN));
    expect(mockTokenRepo.findByTokenHash).not.toHaveBeenCalledWith(RAW_TOKEN);
  });

  it('scopes the patient lookup by the clinicId on the token', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({ locale: 'en' } as never);

    await patientGuard.requirePatient();
    expect(mockPatientRepo.findById).toHaveBeenCalledWith(PATIENT_ID, CLINIC_ID);
  });

  it('returns the patient locale, which drives push copy', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({ locale: 'en' } as never);
    const result = await patientGuard.requirePatient();
    expect(result?.locale).toBe('en');
  });

  it('returns null when the cookie is absent', async () => {
    setCookie(undefined);
    expect(await patientGuard.requirePatient()).toBeNull();
    expect(mockTokenRepo.findByTokenHash).not.toHaveBeenCalled();
  });

  it('returns null when the token is unknown', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(null);
    expect(await patientGuard.requirePatient()).toBeNull();
  });

  it('returns null when the token has been revoked', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(
      tokenRow({ revokedAt: new Date('2025-01-01T00:00:00Z') }) as never
    );
    expect(await patientGuard.requirePatient()).toBeNull();
    expect(mockPatientRepo.findById).not.toHaveBeenCalled();
  });

  it('returns null when the token has expired', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(
      tokenRow({ expiresAt: new Date(Date.now() - 1000) }) as never
    );
    expect(await patientGuard.requirePatient()).toBeNull();
  });

  it('returns null when the patient record no longer resolves', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce(null);
    expect(await patientGuard.requirePatient()).toBeNull();
  });
});

describe('PatientGuard class', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is instantiable independently of the singleton', async () => {
    setCookie(undefined);
    expect(await new PatientGuard().requirePatient()).toBeNull();
  });
});
