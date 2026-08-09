import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({
  mongo: {
    connect: vi.fn(),
  },
}));

vi.mock('@/features/auth/schema/password-reset-token.schema', () => ({
  PasswordResetTokenModel: {
    create: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
  },
}));

import { PasswordResetTokenModel } from '@/features/auth/schema/password-reset-token.schema';
import { mongo } from '@/shared/lib/mongo';

import { passwordResetTokenRepository } from './password-reset-token.repository';

const mockMongo = vi.mocked(mongo);
const mockModel = vi.mocked(PasswordResetTokenModel);

const fakeToken = {
  _id: '507f1f77bcf86cd799439012',
  userId: '507f1f77bcf86cd799439011',
  tokenHash: 'hash',
  expiresAt: new Date(),
  usedAt: null,
};

function makeLeanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

describe('passwordResetTokenRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create connects and returns the new id', async () => {
    (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439012' },
    });

    const id = await passwordResetTokenRepository.create({
      userId: fakeToken.userId as never,
      tokenHash: 'hash',
      expiresAt: fakeToken.expiresAt,
      usedAt: null,
    });

    expect(mockMongo.connect).toHaveBeenCalled();
    expect(id).toBe('507f1f77bcf86cd799439012');
  });

  it('findByTokenHash queries on the hash alone', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeLeanQuery(fakeToken));

    const result = await passwordResetTokenRepository.findByTokenHash('hash');

    expect(mockMongo.connect).toHaveBeenCalled();
    expect(mockModel.findOne).toHaveBeenCalledWith({ tokenHash: 'hash' });
    expect(result).toEqual(fakeToken);
  });

  it('findByTokenHash returns null for an unknown hash', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeLeanQuery(null));
    expect(await passwordResetTokenRepository.findByTokenHash('nope')).toBeNull();
  });

  it('markUsed reports whether a row matched', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const usedAt = new Date();

    const ok = await passwordResetTokenRepository.markUsed(fakeToken._id, usedAt);

    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: fakeToken._id },
      { $set: { usedAt } }
    );
    expect(ok).toBe(true);
  });

  it('markAllUsedForUser touches only tokens still unspent', async () => {
    (mockModel.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ modifiedCount: 2 });
    const usedAt = new Date();

    const count = await passwordResetTokenRepository.markAllUsedForUser(fakeToken.userId, usedAt);

    expect(mockModel.updateMany).toHaveBeenCalledWith(
      { userId: fakeToken.userId, usedAt: null },
      { $set: { usedAt } }
    );
    expect(count).toBe(2);
  });
});
