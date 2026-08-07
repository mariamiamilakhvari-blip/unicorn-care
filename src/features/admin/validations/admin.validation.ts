import { z } from 'zod';

/** Page size ceiling. A console page is read by a person, not paged through by a script. */
export const ADMIN_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Shared list query for both admin tables. */
export const AdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(ADMIN_PAGE_SIZE),
  /* Free-text match on name and email. Bounded so a pathological pattern cannot reach the driver. */
  search: z.string().trim().max(120).default(''),
});

export type AdminListQueryType = z.infer<typeof AdminListQuerySchema>;

/**
 * `PATCH /api/admin/users/[id]`.
 *
 * Exactly one field per request, both optional, and the service rejects a body that changes
 * nothing. Role and activation are separate decisions with separate consequences, and a form that
 * submits both at once makes "what did this admin actually do" unanswerable from the request.
 */
export const UpdateAdminUserSchema = z.object({
  /*
    `clinic_owner` and `clinic_staff` are absent on purpose. Both carry a `clinicId`, and granting
    one from here would produce a clinic role pointing at no clinic — an account that passes the
    tenancy guard's role check and then fails its `clinicId` check on every request. Clinic
    membership is granted by registration and by the staff route, which set both together.
  */
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAdminUserType = z.infer<typeof UpdateAdminUserSchema>;
