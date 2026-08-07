import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib/auth', () => ({ auth: vi.fn() }));

import { adminGuard } from '@/shared/lib/admin-guard';
import { auth } from '@/shared/lib/auth';

const mockAuth = vi.mocked(auth);

const session = (user: Record<string, unknown> | null) =>
  (user ? { user, expires: '' } : null) as never;

/**
 * The only thing standing between a signed-in clinic user and every account on the platform.
 * Each case is a way that check could be quietly weakened.
 */
describe('adminGuard.requireAdmin', () => {
  beforeEach(() => vi.resetAllMocks());

  it('admits an admin', async () => {
    mockAuth.mockResolvedValue(session({ id: 'u1', role: 'admin' }));

    expect(await adminGuard.requireAdmin()).toEqual({ userId: 'u1' });
  });

  it.each([
    ['a clinic owner', 'clinic_owner'],
    ['clinic staff', 'clinic_staff'],
    ['a plain user', 'user'],
    ['an unknown role', 'superuser'],
  ])('refuses %s', async (_label, role) => {
    mockAuth.mockResolvedValue(session({ id: 'u1', role }));

    expect(await adminGuard.requireAdmin()).toBeNull();
  });

  it('refuses a session with no role at all', async () => {
    mockAuth.mockResolvedValue(session({ id: 'u1' }));

    expect(await adminGuard.requireAdmin()).toBeNull();
  });

  it('refuses an admin with no id, since the self-modification check needs one', async () => {
    mockAuth.mockResolvedValue(session({ role: 'admin' }));

    expect(await adminGuard.requireAdmin()).toBeNull();
  });

  it('refuses an unauthenticated caller', async () => {
    mockAuth.mockResolvedValue(session(null));

    expect(await adminGuard.requireAdmin()).toBeNull();
  });
});
