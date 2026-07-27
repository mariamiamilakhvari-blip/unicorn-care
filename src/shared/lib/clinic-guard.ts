import { auth } from '@/shared/lib/auth';
import { CLINIC_ROLES, ClinicRole } from '@/shared/types/roles';

export type ClinicSession = {
  userId: string;
  clinicId: string;
  role: ClinicRole;
};

/**
 * Tenancy guard (PRD 02 §A). Every clinical service takes `clinicId` from the session — never
 * from the request body. Returns `null` instead of throwing so callers stay on the
 * `ServiceResult` path.
 */
class ClinicGuard {
  async requireClinicUser(): Promise<ClinicSession | null> {
    const session = await auth();
    if (!session?.user) return null;

    const user = session.user as typeof session.user & {
      id?: string;
      role?: string;
      clinicId?: string | null;
    };

    const role = CLINIC_ROLES.find(candidate => candidate === user.role);
    if (!role) return null;
    if (!user.id || !user.clinicId) return null;

    return { userId: user.id, clinicId: user.clinicId, role };
  }

  async requireOwner(): Promise<ClinicSession | null> {
    const session = await this.requireClinicUser();
    if (!session) return null;
    if (session.role !== 'clinic_owner') return null;
    return session;
  }
}

export const clinicGuard = new ClinicGuard();
export { ClinicGuard };
