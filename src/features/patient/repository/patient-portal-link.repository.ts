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
   * the credential and the row is what says who it belongs to. The caller checks `expiresAt`; the
   * row existing at all is the rest of the answer, because revocation deletes it.
   */
  async findByTokenHash(tokenHash: string): Promise<PatientPortalLinkDocument | null> {
    await mongo.connect();
    return PatientPortalLinkModel.findOne({ tokenHash }).lean<PatientPortalLinkDocument>().exec();
  },

  /**
   * Stamps the first redemption, for the audit trail.
   *
   * `usedAt: null` stays in the filter so the stamp records the *first* use rather than the latest,
   * and so a later redemption is a no-op rather than a write. It no longer gates anything: the
   * caller does not consult the return value, because a link is reusable until it expires.
   */
  async markUsed(id: string, usedAt: Date): Promise<boolean> {
    await mongo.connect();
    const result = await PatientPortalLinkModel.updateOne(
      { _id: id, usedAt: null },
      { $set: { usedAt } }
    );
    return result.modifiedCount > 0;
  },

  /**
   * Kills every link in one patient's inbox, whether or not it has been opened.
   *
   * A delete rather than a flag, and that is the load-bearing part of making links reusable. The
   * old revocation marked rows `usedAt`, which worked only because redemption refused a used row —
   * the moment reuse was allowed, that same call would have left every emailed link live. Absence
   * is the one signal redemption cannot misread.
   */
  async revokeAllForPatient(patientId: string): Promise<number> {
    await mongo.connect();
    const result = await PatientPortalLinkModel.deleteMany({ patientId });
    return result.deletedCount;
  },

  /** Purges every row this clinic owns. Only the cascade-deletion services call this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await PatientPortalLinkModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

  /** Purges every row for one patient, scoped to their clinic so it can never reach another's. */
  async deleteAllByPatient(patientId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await PatientPortalLinkModel.deleteMany({ patientId, clinicId });
    return result.deletedCount;
  },
};
