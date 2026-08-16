import {
  PatientPortalLinkDocument,
  PatientPortalLinkModel,
} from '@/features/patient/schema/patient-portal-link.schema';
import { mongo } from '@/shared/lib/mongo';

export const patientPortalLinkRepository = {
  async create(
    data: Omit<PatientPortalLinkDocument, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    await mongo.connect();
    const doc = await PatientPortalLinkModel.create(data);
    return doc._id.toString();
  },

  /**
   * Redemption lookup. Not clinic-scoped, for the same reason as the access tokens: the token is
   * the credential and the row is what says who it belongs to. The caller checks `usedAt` and
   * `expiresAt`.
   */
  async findByTokenHash(tokenHash: string): Promise<PatientPortalLinkDocument | null> {
    await mongo.connect();
    return PatientPortalLinkModel.findOne({ tokenHash }).lean<PatientPortalLinkDocument>().exec();
  },

  /**
   * Spends one link and only that link.
   *
   * `usedAt: null` is part of the filter rather than something the caller checks first, so two
   * requests carrying the same token cannot both be told they redeemed it.
   */
  async markUsed(id: string, usedAt: Date): Promise<boolean> {
    await mongo.connect();
    const result = await PatientPortalLinkModel.updateOne(
      { _id: id, usedAt: null },
      { $set: { usedAt } }
    );
    return result.modifiedCount > 0;
  },

  async markAllUsedForPatient(patientId: string, usedAt: Date): Promise<number> {
    await mongo.connect();
    const result = await PatientPortalLinkModel.updateMany(
      { patientId, usedAt: null },
      { $set: { usedAt } }
    );
    return result.modifiedCount;
  },
};
