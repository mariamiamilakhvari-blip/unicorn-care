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

  async markAllUsedForPatient(patientId: string, usedAt: Date): Promise<number> {
    await mongo.connect();
    const result = await PatientPortalLinkModel.updateMany(
      { patientId, usedAt: null },
      { $set: { usedAt } }
    );
    return result.modifiedCount;
  },
};
