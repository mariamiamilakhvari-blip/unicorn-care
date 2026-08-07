import { AdminUserListView, AdminUserView } from '@/features/admin/types/admin.types';
import {
  AdminListQueryType,
  UpdateAdminUserType,
} from '@/features/admin/validations/admin.validation';
import { userRepository, UserFilter } from '@/features/auth/repository/user.repository';
import { UserDocument } from '@/features/auth/schema/user.schema';
import { ServiceResult } from '@/shared/types/common';
import { UserRole } from '@/shared/types/roles';

/** Field by field, so a password hash cannot reach the wire by someone spreading a document. */
function toView(user: UserDocument): AdminUserView {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    clinicId: user.clinicId?.toString() ?? null,
    jobTitle: user.jobTitle ?? '',
    // Predates the field on older rows, where absent means the account was never deactivated.
    isActive: user.isActive ?? true,
    createdAt: (user.createdAt ?? new Date()).toISOString(),
  };
}

/** Escapes a user's search text so it is matched literally rather than as a pattern. */
function toSearchFilter(search: string): UserFilter {
  if (!search) return {};

  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'i');
  return { $or: [{ name: pattern }, { email: pattern }] };
}

export async function listAdminUsersService(
  query: AdminListQueryType
): Promise<ServiceResult<AdminUserListView>> {
  const skip = (query.page - 1) * query.pageSize;
  const { items, total } = await userRepository.findPage(
    toSearchFilter(query.search),
    skip,
    query.pageSize
  );

  return {
    data: { items: items.map(toView), total, page: query.page, pageSize: query.pageSize },
    status: 200,
  };
}

/**
 * Changes a user's role or activation.
 *
 * Three refusals, all of them about the same failure: an admin locking the platform out of its
 * own console, which no in-app path can undo.
 *
 * - Never the caller's own account. Demoting or deactivating yourself takes effect on your next
 *   token refresh, and the page you would fix it from is the page you just lost.
 * - Never the last active admin. One admin who leaves the company and one who fat-fingers a
 *   toggle produce the same outcome, and it needs a database edit to recover from.
 * - Never a clinic role. Those carry a `clinicId` that this route cannot set, and the schema
 *   already refuses anything outside the enum.
 */
export async function updateAdminUserService(
  actorId: string,
  targetId: string,
  input: UpdateAdminUserType
): Promise<ServiceResult<AdminUserView>> {
  if (input.role === undefined && input.isActive === undefined) {
    return { data: { error: 'NO_CHANGES' }, status: 400 };
  }

  if (actorId === targetId) {
    return { data: { error: 'CANNOT_MODIFY_SELF' }, status: 400 };
  }

  const target = await userRepository.findById(targetId);
  if (!target) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const wasActiveAdmin = target.role === 'admin' && (target.isActive ?? true);
  const losesAdmin = input.role !== undefined && input.role !== 'admin';
  const losesAccess = input.isActive === false;

  if (wasActiveAdmin && (losesAdmin || losesAccess)) {
    const activeAdmins = await userRepository.countByRole('admin');
    if (activeAdmins <= 1) {
      return { data: { error: 'LAST_ADMIN' }, status: 409 };
    }
  }

  const changes: Partial<UserDocument> = {};
  if (input.role !== undefined) changes.role = input.role;
  if (input.isActive !== undefined) changes.isActive = input.isActive;

  const updated = await userRepository.updateById(targetId, changes);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const fresh = await userRepository.findById(targetId);
  if (!fresh) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toView(fresh), status: 200 };
}
