import {
  PatientAccessTokenDocument,
  PatientAccessTokenModel,
} from '@/features/patient/schema/patient-access-token.schema';
import { mongo } from '@/shared/lib/mongo';

export const patientAccessTokenRepository = {
  async create(
    data: Omit<PatientAccessTokenDocument, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    await mongo.connect();
    const doc = await PatientAccessTokenModel.create(data);
    return doc._id.toString();
  },

  /**
   * Redemption lookup. Intentionally NOT clinic-scoped: the token itself is the credential and
   * the row is what tells us which clinic the holder belongs to. The caller (patientGuard /
   * redemption route) must still check `revokedAt` and `expiresAt`.
   */
  async findByTokenHash(tokenHash: string): Promise<PatientAccessTokenDocument | null> {
    await mongo.connect();
    return PatientAccessTokenModel.findOne({ tokenHash })
      .lean<PatientAccessTokenDocument>()
      .exec();
  },

  async revokeAllForPatient(
    patientId: string,
    clinicId: string,
    revokedAt: Date
  ): Promise<number> {
    await mongo.connect();
    const result = await PatientAccessTokenModel.updateMany(
      { patientId, clinicId, revokedAt: null },
      { $set: { revokedAt } }
    );
    return result.modifiedCount;
  },

  async touchLastUsed(id: string, lastUsedAt: Date): Promise<boolean> {
    await mongo.connect();
    const result = await PatientAccessTokenModel.updateOne({ _id: id }, { $set: { lastUsedAt } });
    return result.matchedCount > 0;
  },

  async findActiveByPatient(
    patientId: string,
    clinicId: string
  ): Promise<PatientAccessTokenDocument[]> {
    await mongo.connect();
    return PatientAccessTokenModel.find({ patientId, clinicId, revokedAt: null })
      .lean<PatientAccessTokenDocument[]>()
      .exec();
  },
};
