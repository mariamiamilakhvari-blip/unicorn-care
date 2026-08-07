import { UserRole } from '@/shared/types/roles';

/**
 * A user as the admin console lists them.
 *
 * `passwordHash` is absent by construction rather than by deletion — the view is built field by
 * field, so a hash cannot reach the wire because someone spread a document into a response.
 */
export type AdminUserView = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clinicId: string | null;
  jobTitle: string;
  isActive: boolean;
  createdAt: string;
};

export type AdminUserListView = {
  items: AdminUserView[];
  total: number;
  page: number;
  pageSize: number;
};

/** An uploaded file as the console lists it. */
export type AdminFileView = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedByUserId: string;
  createdAt: string;
};

export type AdminFileListView = {
  items: AdminFileView[];
  total: number;
  page: number;
  pageSize: number;
};
