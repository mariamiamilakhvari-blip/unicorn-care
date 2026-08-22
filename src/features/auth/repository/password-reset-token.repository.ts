import {
  PasswordResetTokenDocument,
  PasswordResetTokenModel,
} from '@/features/auth/schema/password-reset-token.schema';
import { mongo } from '@/shared/lib/mongo';

export const passwordResetTokenRepository = {
  async create(
    data: Omit<PasswordResetTokenDocument, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    await mongo.connect();
    const doc = await PasswordResetTokenModel.create(data);
    return doc._id.toString();
  },

  /**
   * Redemption lookup. Not user-scoped: the token is the credential, and the row is what says whose
   * account it opens. The caller still has to check `usedAt` and `expiresAt`.
   */
  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenDocument | null> {
    await mongo.connect();
    return PasswordResetTokenModel.findOne({ tokenHash })
      .lean<PasswordResetTokenDocument>()
      .exec();
  },

  async markUsed(id: string, usedAt: Date): Promise<boolean> {
    await mongo.connect();
    const result = await PasswordResetTokenModel.updateOne({ _id: id }, { $set: { usedAt } });
    return result.matchedCount > 0;
  },

  /** Spends every outstanding token for one account in a single write. */
  async markAllUsedForUser(userId: string, usedAt: Date): Promise<number> {
    await mongo.connect();
    const result = await PasswordResetTokenModel.updateMany(
      { userId, usedAt: null },
      { $set: { usedAt } }
    );
    return result.modifiedCount;
  },

  /**
   * Purges reset tokens belonging to a set of users.
   *
   * By user id, because this collection carries no `clinicId` — and a live reset token outliving
   * its user is the worst of the orphans, since it is a credential. Nothing would ever redeem it
   * once the account is gone, but it should not be sitting in the database either.
   */
  async deleteAllByUsers(userIds: string[]): Promise<number> {
    await mongo.connect();
    const result = await PasswordResetTokenModel.deleteMany({ userId: { $in: userIds } });
    return result.deletedCount;
  },
};
