import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/repository/user.repository', () => ({
  userRepository: {
    findById: vi.fn(),
    findPage: vi.fn(),
    countByRole: vi.fn(),
    updateById: vi.fn(),
  },
}));

import {
  listAdminUsersService,
  updateAdminUserService,
} from '@/features/admin/service/admin-user.service';
import { AdminUserView } from '@/features/admin/types/admin.types';
import { userRepository } from '@/features/auth/repository/user.repository';
import { UserDocument } from '@/features/auth/schema/user.schema';

const repo = vi.mocked(userRepository);

const ADMIN_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';

const user = (overrides: Partial<UserDocument> = {}): UserDocument =>
  ({
    _id: new mongoose.Types.ObjectId(OTHER_ID),
    name: 'Nino Beridze',
    email: 'nino@example.com',
    passwordHash: 'a'.repeat(64),
    role: 'user',
    clinicId: null,
    jobTitle: '',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  }) as UserDocument;

describe('listAdminUsersService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findPage.mockResolvedValue({ items: [user()], total: 1 });
  });

  it('never puts a password hash on the wire', async () => {
    const result = await listAdminUsersService({ page: 1, pageSize: 20, search: '' });

    const [first] = (result.data as { items: AdminUserView[] }).items;
    expect(first).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result.data)).not.toContain('a'.repeat(64));
  });

  it('searches name and email together', async () => {
    await listAdminUsersService({ page: 1, pageSize: 20, search: 'nino' });

    const [filter] = repo.findPage.mock.calls[0];
    expect(filter.$or).toHaveLength(2);
  });

  it('matches a search term literally rather than as a pattern', async () => {
    // Unescaped, `.*` would match every user — a search box is not a query language.
    await listAdminUsersService({ page: 1, pageSize: 20, search: '.*' });

    const [filter] = repo.findPage.mock.calls[0];
    const pattern = filter.$or?.[0] as { name: RegExp };
    expect(pattern.name.test('anybody')).toBe(false);
    expect(pattern.name.test('literally .* here')).toBe(true);
  });

  it('passes no filter when the search is empty, so the first page is everyone', async () => {
    await listAdminUsersService({ page: 1, pageSize: 20, search: '' });

    expect(repo.findPage.mock.calls[0][0]).toEqual({});
  });

  it('turns the page number into a skip', async () => {
    await listAdminUsersService({ page: 3, pageSize: 20, search: '' });

    expect(repo.findPage).toHaveBeenCalledWith({}, 40, 20);
  });
});

/**
 * Every refusal here is about one failure: an admin locking the platform out of its own console.
 * None of them can be undone from inside the app — the recovery is a database edit — so they are
 * pinned rather than left to the UI to avoid.
 */
describe('updateAdminUserService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findById.mockResolvedValue(user());
    repo.updateById.mockResolvedValue(true);
    repo.countByRole.mockResolvedValue(5);
  });

  it('changes a role', async () => {
    repo.findById.mockResolvedValueOnce(user()).mockResolvedValueOnce(user({ role: 'admin' }));

    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, { role: 'admin' });

    expect(result.status).toBe(200);
    expect(repo.updateById).toHaveBeenCalledWith(OTHER_ID, { role: 'admin' });
  });

  it('deactivates without deleting the row', async () => {
    repo.findById
      .mockResolvedValueOnce(user())
      .mockResolvedValueOnce(user({ isActive: false }));

    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, { isActive: false });

    expect(result.status).toBe(200);
    expect(repo.updateById).toHaveBeenCalledWith(OTHER_ID, { isActive: false });
    expect((result.data as AdminUserView).isActive).toBe(false);
  });

  it("refuses to act on the caller's own account", async () => {
    const result = await updateAdminUserService(ADMIN_ID, ADMIN_ID, { role: 'user' });

    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: 'CANNOT_MODIFY_SELF' });
    expect(repo.updateById).not.toHaveBeenCalled();
  });

  it('refuses to demote the last active admin', async () => {
    repo.findById.mockResolvedValue(user({ role: 'admin' }));
    repo.countByRole.mockResolvedValue(1);

    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, { role: 'user' });

    expect(result.status).toBe(409);
    expect(result.data).toEqual({ error: 'LAST_ADMIN' });
    expect(repo.updateById).not.toHaveBeenCalled();
  });

  it('refuses to deactivate the last active admin', async () => {
    repo.findById.mockResolvedValue(user({ role: 'admin' }));
    repo.countByRole.mockResolvedValue(1);

    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, { isActive: false });

    expect(result.data).toEqual({ error: 'LAST_ADMIN' });
  });

  it('allows demoting an admin while others remain', async () => {
    repo.findById
      .mockResolvedValueOnce(user({ role: 'admin' }))
      .mockResolvedValueOnce(user({ role: 'user' }));
    repo.countByRole.mockResolvedValue(2);

    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, { role: 'user' });

    expect(result.status).toBe(200);
  });

  it('does not count admins when the change cannot remove one', async () => {
    // Promoting a plain user cannot reduce the admin count, so the guard must not run.
    repo.findById.mockResolvedValueOnce(user()).mockResolvedValueOnce(user({ role: 'admin' }));

    await updateAdminUserService(ADMIN_ID, OTHER_ID, { role: 'admin' });

    expect(repo.countByRole).not.toHaveBeenCalled();
  });

  it('treats an already-deactivated admin as not counting toward the last one', async () => {
    // They cannot sign in, so they are not the admin standing between the platform and lockout.
    repo.findById
      .mockResolvedValueOnce(user({ role: 'admin', isActive: false }))
      .mockResolvedValueOnce(user({ role: 'user', isActive: false }));

    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, { role: 'user' });

    expect(result.status).toBe(200);
    expect(repo.countByRole).not.toHaveBeenCalled();
  });

  it('rejects a body that changes nothing', async () => {
    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, {});

    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: 'NO_CHANGES' });
  });

  it('404s on a user that does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await updateAdminUserService(ADMIN_ID, OTHER_ID, { role: 'admin' });

    expect(result.status).toBe(404);
  });
});
