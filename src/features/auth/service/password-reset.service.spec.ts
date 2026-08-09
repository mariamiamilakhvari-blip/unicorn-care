import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/auth/repository/user.repository', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('@/features/auth/repository/password-reset-token.repository', () => ({
  passwordResetTokenRepository: {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    markUsed: vi.fn(),
    markAllUsedForUser: vi.fn(),
  },
}));

vi.mock('@/features/notifications/service/password-reset-email.service', () => ({
  sendPasswordResetEmailService: vi.fn(),
}));

import { passwordResetTokenRepository } from '@/features/auth/repository/password-reset-token.repository';
import { userRepository } from '@/features/auth/repository/user.repository';
import { sendPasswordResetEmailService } from '@/features/notifications/service/password-reset-email.service';
import { hashPassword } from '@/shared/utils/password';

import {
  requestPasswordResetService,
  resetPasswordService,
  verifyResetTokenService,
} from './password-reset.service';

const mockUsers = vi.mocked(userRepository);
const mockTokens = vi.mocked(passwordResetTokenRepository);
const mockEmail = vi.mocked(sendPasswordResetEmailService);

const USER_ID = '507f1f77bcf86cd799439011';

const fakeUser = {
  _id: { toString: () => USER_ID },
  name: 'Alice',
  email: 'alice@example.com',
  passwordHash: 'old-hash',
  role: 'clinic_owner' as const,
  isActive: true,
};

/** A stored token row, redeemable unless a test says otherwise. */
const tokenRow = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => '507f1f77bcf86cd799439012' },
  userId: { toString: () => USER_ID },
  tokenHash: 'hash',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  usedAt: null,
  ...overrides,
});

describe('requestPasswordResetService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers 200 for an address with no account, and sends nothing', async () => {
    mockUsers.findByEmail.mockResolvedValueOnce(null);

    const result = await requestPasswordResetService({ email: 'nobody@example.com', locale: 'ka' });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: 'RESET_REQUESTED' });
    expect(mockTokens.create).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it('answers identically for a known address, so the two cannot be told apart', async () => {
    mockUsers.findByEmail.mockResolvedValueOnce(fakeUser as never);
    mockTokens.markAllUsedForUser.mockResolvedValueOnce(0);
    mockTokens.create.mockResolvedValueOnce('507f1f77bcf86cd799439012');
    mockEmail.mockResolvedValueOnce(true);

    const known = await requestPasswordResetService({ email: fakeUser.email, locale: 'ka' });

    expect(known.status).toBe(200);
    expect(known.data).toEqual({ message: 'RESET_REQUESTED' });
  });

  it('issues nothing for a deactivated account', async () => {
    mockUsers.findByEmail.mockResolvedValueOnce({ ...fakeUser, isActive: false } as never);

    const result = await requestPasswordResetService({ email: fakeUser.email, locale: 'ka' });

    expect(result.status).toBe(200);
    expect(mockTokens.create).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it('issues a link for a Google account that holds no password yet', async () => {
    mockUsers.findByEmail.mockResolvedValueOnce({ ...fakeUser, passwordHash: '' } as never);
    mockTokens.markAllUsedForUser.mockResolvedValueOnce(0);
    mockTokens.create.mockResolvedValueOnce('507f1f77bcf86cd799439012');
    mockEmail.mockResolvedValueOnce(true);

    await requestPasswordResetService({ email: fakeUser.email, locale: 'ka' });

    expect(mockEmail).toHaveBeenCalledTimes(1);
  });

  it('spends outstanding tokens before writing the new one', async () => {
    const order: string[] = [];
    mockUsers.findByEmail.mockResolvedValueOnce(fakeUser as never);
    mockTokens.markAllUsedForUser.mockImplementationOnce(async () => {
      order.push('revoke');
      return 1;
    });
    mockTokens.create.mockImplementationOnce(async () => {
      order.push('create');
      return '507f1f77bcf86cd799439012';
    });
    mockEmail.mockResolvedValueOnce(true);

    await requestPasswordResetService({ email: fakeUser.email, locale: 'ka' });

    expect(order).toEqual(['revoke', 'create']);
  });

  it('stores only the hash, and mails a link carrying the raw token', async () => {
    mockUsers.findByEmail.mockResolvedValueOnce(fakeUser as never);
    mockTokens.markAllUsedForUser.mockResolvedValueOnce(0);
    mockTokens.create.mockResolvedValueOnce('507f1f77bcf86cd799439012');
    mockEmail.mockResolvedValueOnce(true);

    await requestPasswordResetService({ email: fakeUser.email, locale: 'en' });

    const stored = mockTokens.create.mock.calls[0][0];
    const sentUrl = mockEmail.mock.calls[0][0].resetUrl;
    const rawToken = new URL(sentUrl).searchParams.get('token') ?? '';

    expect(rawToken.length).toBeGreaterThan(20);
    expect(sentUrl).not.toContain(stored.tokenHash);
    expect(stored.tokenHash).toBe(hashPassword(rawToken));
  });

  it('still answers 200 when the mail provider refuses the send', async () => {
    mockUsers.findByEmail.mockResolvedValueOnce(fakeUser as never);
    mockTokens.markAllUsedForUser.mockResolvedValueOnce(0);
    mockTokens.create.mockResolvedValueOnce('507f1f77bcf86cd799439012');
    mockEmail.mockResolvedValueOnce(false);

    const result = await requestPasswordResetService({ email: fakeUser.email, locale: 'ka' });

    expect(result.status).toBe(200);
  });
});

describe('verifyResetTokenService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a live token', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    const result = await verifyResetTokenService('raw-token');
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ valid: true });
  });

  it('looks the token up by hash, never by raw value', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    await verifyResetTokenService('raw-token');
    expect(mockTokens.findByTokenHash).toHaveBeenCalledWith(hashPassword('raw-token'));
  });

  it('rejects unknown, spent and expired tokens with the same answer', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(null);
    const unknown = await verifyResetTokenService('raw-token');

    mockTokens.findByTokenHash.mockResolvedValueOnce(tokenRow({ usedAt: new Date() }) as never);
    const spent = await verifyResetTokenService('raw-token');

    mockTokens.findByTokenHash.mockResolvedValueOnce(
      tokenRow({ expiresAt: new Date(Date.now() - 1000) }) as never
    );
    const expired = await verifyResetTokenService('raw-token');

    for (const result of [unknown, spent, expired]) {
      expect(result.status).toBe(400);
      expect(result.data).toEqual({ error: 'INVALID_TOKEN' });
    }
  });
});

describe('resetPasswordService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets the new password hash on the account the token names', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockUsers.findById.mockResolvedValueOnce(fakeUser as never);
    mockTokens.markAllUsedForUser.mockResolvedValueOnce(1);
    mockUsers.updateById.mockResolvedValueOnce(true);

    const result = await resetPasswordService({ token: 'raw-token', password: 'newpassword1' });

    expect(result.status).toBe(200);
    expect(mockUsers.updateById).toHaveBeenCalledWith(USER_ID, {
      passwordHash: hashPassword('newpassword1'),
    });
  });

  it('spends every outstanding token for the account, not only the one used', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockUsers.findById.mockResolvedValueOnce(fakeUser as never);
    mockTokens.markAllUsedForUser.mockResolvedValueOnce(2);
    mockUsers.updateById.mockResolvedValueOnce(true);

    await resetPasswordService({ token: 'raw-token', password: 'newpassword1' });

    expect(mockTokens.markAllUsedForUser).toHaveBeenCalledWith(USER_ID, expect.any(Date));
  });

  it('refuses a token that has already been spent, and changes nothing', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(tokenRow({ usedAt: new Date() }) as never);

    const result = await resetPasswordService({ token: 'raw-token', password: 'newpassword1' });

    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: 'INVALID_TOKEN' });
    expect(mockUsers.updateById).not.toHaveBeenCalled();
  });

  it('refuses an expired token, and changes nothing', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(
      tokenRow({ expiresAt: new Date(Date.now() - 1000) }) as never
    );

    const result = await resetPasswordService({ token: 'raw-token', password: 'newpassword1' });

    expect(result.status).toBe(400);
    expect(mockUsers.updateById).not.toHaveBeenCalled();
  });

  it('refuses a live token whose account was deactivated in the meantime', async () => {
    mockTokens.findByTokenHash.mockResolvedValueOnce(tokenRow() as never);
    mockUsers.findById.mockResolvedValueOnce({ ...fakeUser, isActive: false } as never);

    const result = await resetPasswordService({ token: 'raw-token', password: 'newpassword1' });

    expect(result.status).toBe(400);
    expect(result.data).toEqual({ error: 'INVALID_TOKEN' });
    expect(mockUsers.updateById).not.toHaveBeenCalled();
  });
});
