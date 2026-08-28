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
import { ERASED_PLACEHOLDER } from '@/shared/const/retention.const';
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
    mockPatientRepo.findById.mockResolvedValueOnce({
      locale: 'ka',
      firstName: 'Nini',
      lastName: 'Nutsibidze',
    } as never);

    expect(await patientGuard.requirePatient()).toEqual({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      locale: 'ka',
      patientName: 'Nini Nutsibidze',
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

  /*
    The inverse of the test this replaces. A stale `expiresAt` left on a row written before links
    became permanent must not lock the patient out — nothing reads the field any more, and this
    is what says so.
  */
  it('admits a token carrying a long-past expiresAt from before links were permanent', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(
      tokenRow({ expiresAt: new Date('2020-01-01T00:00:00Z') }) as never
    );
    mockPatientRepo.findById.mockResolvedValueOnce({
      locale: 'ka',
      firstName: 'Nini',
      lastName: 'Nutsibidze',
    } as never);

    expect(await patientGuard.requirePatient()).toEqual({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      locale: 'ka',
      patientName: 'Nini Nutsibidze',
    });
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

/**
 * The name the portal prints to say whose plan is on screen.
 *
 * Resolved here rather than in a second query, because the guard already loads the patient record
 * to check portal consent and is holding the document the name is on.
 */
describe('patientGuard.requirePatient — whose session this is', () => {
  beforeEach(() => vi.clearAllMocks());

  it('carries the patient name, joined from the record', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({
      locale: 'ka',
      firstName: 'Nini',
      lastName: 'Nutsibidze',
    } as never);

    const session = await patientGuard.requirePatient();

    expect(session?.patientName).toBe('Nini Nutsibidze');
  });

  /* No second lookup: the record was already fetched to check consent. */
  it('costs no extra query', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({
      locale: 'ka',
      firstName: 'Nini',
      lastName: 'Nutsibidze',
    } as never);

    await patientGuard.requirePatient();

    expect(mockPatientRepo.findById).toHaveBeenCalledTimes(1);
  });

  /*
    An erased record resolves to no name, never to the placeholder. `[ERASED] [ERASED]` printed
    under "viewing the plan of" reads as a broken page rather than as a closed account, and the
    portal has its own words for the second.
  */
  it('gives an erased record no name rather than the placeholder', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({
      locale: 'ka',
      firstName: ERASED_PLACEHOLDER,
      lastName: ERASED_PLACEHOLDER,
    } as never);

    const session = await patientGuard.requirePatient();

    expect(session?.patientName).toBe('');
    // Still a session: an erased patient keeps their plan and their way off this device.
    expect(session?.patientId).toBe(PATIENT_ID);
  });

  /* A record holding only one of the two names must not come back with a dangling space. */
  it('trims a record that carries only one name', async () => {
    setCookie(RAW_TOKEN);
    mockTokenRepo.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockPatientRepo.findById.mockResolvedValueOnce({
      locale: 'ka',
      firstName: 'Nini',
      lastName: '',
    } as never);

    expect((await patientGuard.requirePatient())?.patientName).toBe('Nini');
  });
});
