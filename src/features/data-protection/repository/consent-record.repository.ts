import {
  ConsentRecordDocument,
  ConsentRecordModel,
} from '@/features/data-protection/schema/consent-record.schema';
import { ConsentType } from '@/shared/const/consent-type.const';
import { mongo } from '@/shared/lib/mongo';

/**
 * Append-only by construction. There is no `updateById` and no delete path: the only write that
 * touches an existing row is `revoke`, which sets the withdrawal fields and nothing else.
 *
 * Every read is clinic-scoped (PRD 02), with the single documented exception of `findActive`,
 * which the dispatcher reaches through the patient it has already resolved.
 */
export const consentRecordRepository = {
  async create(
    data: Omit<ConsentRecordDocument, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    await mongo.connect();
    const doc = await ConsentRecordModel.create(data);
    return doc._id.toString();
  },

  /** Several consents captured in one act — an intake form — written in one round trip. */
  async createMany(
    data: Omit<ConsentRecordDocument, '_id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<number> {
    await mongo.connect();
    if (data.length === 0) return 0;
    const docs = await ConsentRecordModel.insertMany(data);
    return docs.length;
  },

  /** The standing consent for one purpose, newest first — a re-consent leaves an older row behind. */
  async findActive(
    patientId: string,
    consentType: ConsentType
  ): Promise<ConsentRecordDocument | null> {
    await mongo.connect();
    return ConsentRecordModel.findOne({ patientId, consentType, revokedAt: null })
      .sort({ grantedAt: -1 })
      .lean<ConsentRecordDocument>()
      .exec();
  },

  /** Every standing consent this patient holds. One read behind the portal's settings screen. */
  async findActiveByPatient(patientId: string): Promise<ConsentRecordDocument[]> {
    await mongo.connect();
    return ConsentRecordModel.find({ patientId, revokedAt: null })
      .sort({ grantedAt: -1 })
      .lean<ConsentRecordDocument[]>()
      .exec();
  },

  /** The full history, withdrawals included. The audit trail as the patient may export it. */
  async findAllByPatient(patientId: string): Promise<ConsentRecordDocument[]> {
    await mongo.connect();
    return ConsentRecordModel.find({ patientId })
      .sort({ createdAt: -1 })
      .lean<ConsentRecordDocument[]>()
      .exec();
  },

  /**
   * Withdraws every standing consent of one type.
   *
   * Filtered on `revokedAt: null` so an already-withdrawn row keeps its original withdrawal time —
   * a second call must not re-date the first refusal. Plural because a record can carry more than
   * one standing grant for a purpose if it was ever captured twice, and leaving one of them live
   * would let the dispatcher keep sending.
   */
  async revoke(
    patientId: string,
    consentType: ConsentType,
    revokedAt: Date,
    revokedSource: string,
    note: string
  ): Promise<number> {
    await mongo.connect();
    const result = await ConsentRecordModel.updateMany(
      { patientId, consentType, revokedAt: null },
      { $set: { revokedAt, revokedSource, note } }
    );
    return result.modifiedCount;
  },

  /** Purges every row this clinic owns. Only the account-deletion service calls this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await ConsentRecordModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

  /** Purges every row for one patient, clinic-scoped so it can never reach another tenant's. */
  async deleteAllByPatient(patientId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await ConsentRecordModel.deleteMany({ patientId, clinicId });
    return result.deletedCount;
  },
};
