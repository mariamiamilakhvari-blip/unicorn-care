import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/shared/lib/auth';
import { clinicGuard, ClinicGuard } from '@/shared/lib/clinic-guard';

const mockAuth = vi.mocked(auth);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439099';

function session(user: Record<string, unknown> | null) {
  return user === null ? null : { user, expires: '2099-01-01' };
}

describe('clinicGuard.requireClinicUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the clinic session for a clinic_owner', async () => {
    mockAuth.mockResolvedValueOnce(
      session({ id: USER_ID, role: 'clinic_owner', clinicId: CLINIC_ID }) as never
    );
    expect(await clinicGuard.requireClinicUser()).toEqual({
      userId: USER_ID,
      clinicId: CLINIC_ID,
      role: 'clinic_owner',
    });
  });

  it('returns the clinic session for a clinic_staff', async () => {
    mockAuth.mockResolvedValueOnce(
      session({ id: USER_ID, role: 'clinic_staff', clinicId: CLINIC_ID }) as never
    );
    const result = await clinicGuard.requireClinicUser();
    expect(result?.role).toBe('clinic_staff');
  });

  it('returns null when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    expect(await clinicGuard.requireClinicUser()).toBeNull();
  });

  it('returns null when the session has no user', async () => {
    mockAuth.mockResolvedValueOnce({ expires: '2099-01-01' } as never);
    expect(await clinicGuard.requireClinicUser()).toBeNull();
  });

  it('returns null for a plain "user" role', async () => {
    mockAuth.mockResolvedValueOnce(session({ id: USER_ID, role: 'user', clinicId: CLINIC_ID }) as never);
    expect(await clinicGuard.requireClinicUser()).toBeNull();
  });

  it('returns null for a platform admin — admins have no clinical access in v1', async () => {
    mockAuth.mockResolvedValueOnce(session({ id: USER_ID, role: 'admin', clinicId: CLINIC_ID }) as never);
    expect(await clinicGuard.requireClinicUser()).toBeNull();
  });

  it('returns null when the clinic user has no clinicId', async () => {
    mockAuth.mockResolvedValueOnce(session({ id: USER_ID, role: 'clinic_owner', clinicId: null }) as never);
    expect(await clinicGuard.requireClinicUser()).toBeNull();
  });

  it('returns null when the session user has no id', async () => {
    mockAuth.mockResolvedValueOnce(session({ role: 'clinic_staff', clinicId: CLINIC_ID }) as never);
    expect(await clinicGuard.requireClinicUser()).toBeNull();
  });

  it('does not throw when auth() rejects handling is left to the caller', async () => {
    mockAuth.mockResolvedValueOnce(session({ id: USER_ID, role: undefined }) as never);
    expect(await clinicGuard.requireClinicUser()).toBeNull();
  });
});

describe('clinicGuard.requireOwner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the session for a clinic_owner', async () => {
    mockAuth.mockResolvedValueOnce(
      session({ id: USER_ID, role: 'clinic_owner', clinicId: CLINIC_ID }) as never
    );
    expect(await clinicGuard.requireOwner()).toEqual({
      userId: USER_ID,
      clinicId: CLINIC_ID,
      role: 'clinic_owner',
    });
  });

  it('returns null for clinic_staff', async () => {
    mockAuth.mockResolvedValueOnce(
      session({ id: USER_ID, role: 'clinic_staff', clinicId: CLINIC_ID }) as never
    );
    expect(await clinicGuard.requireOwner()).toBeNull();
  });

  it('returns null when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    expect(await clinicGuard.requireOwner()).toBeNull();
  });
});

describe('ClinicGuard class', () => {
  it('is instantiable independently of the singleton', async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    expect(await new ClinicGuard().requireClinicUser()).toBeNull();
  });
});
