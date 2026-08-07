import { auth } from '@/shared/lib/auth';

export type AdminSession = {
  userId: string;
};

/**
 * Platform-admin guard.
 *
 * Deliberately separate from `ClinicGuard` rather than another method on it. That guard's whole
 * purpose is to produce a `clinicId` every clinical query then filters by; an admin has
 * `clinicId: null` and works across clinics, so folding the two together would put a
 * "sometimes there is no tenant" branch inside the one check the tenancy model rests on.
 *
 * The returned session carries the admin's own id and nothing else — it exists so an admin route
 * can refuse an action against the caller's own account, which is the one mistake here that
 * cannot be undone from inside the app.
 *
 * `role` is re-read from the database on every token refresh (see the `jwt` callback), so
 * demoting an admin takes effect on their next refresh rather than when their session expires.
 *
 * Returns `null` instead of throwing, so callers stay on the `ServiceResult` path.
 */
class AdminGuard {
  async requireAdmin(): Promise<AdminSession | null> {
    const session = await auth();
    if (!session?.user) return null;

    const user = session.user as typeof session.user & { id?: string; role?: string };
    if (user.role !== 'admin') return null;
    if (!user.id) return null;

    return { userId: user.id };
  }
}

export const adminGuard = new AdminGuard();
export { AdminGuard };
