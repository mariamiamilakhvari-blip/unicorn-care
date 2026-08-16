import {
  DataRequestDocument,
  DataRequestModel,
} from '@/features/data-protection/schema/data-request.schema';
import { mongo } from '@/shared/lib/mongo';

/** Tenancy guarantee (PRD 02): every clinic-facing read and write carries `clinicId` in the filter. */
export const dataRequestRepository = {
  async create(data: Omit<DataRequestDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await DataRequestModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string, clinicId: string): Promise<DataRequestDocument | null> {
    await mongo.connect();
    return DataRequestModel.findOne({ _id: id, clinicId }).lean<DataRequestDocument>().exec();
  },

  /** The patient's own history, newest first — what they asked for and what they were told. */
  async findByPatient(patientId: string): Promise<DataRequestDocument[]> {
    await mongo.connect();
    return DataRequestModel.find({ patientId })
      .sort({ requestedAt: -1 })
      .lean<DataRequestDocument[]>()
      .exec();
  },

  /**
   * The clinic's queue. Oldest first: the statutory clock starts when the patient files, so the
   * request that has been waiting longest is the one closest to being late.
   */
  async findOpenByClinic(clinicId: string): Promise<DataRequestDocument[]> {
    await mongo.connect();
    return DataRequestModel.find({ clinicId, status: 'open' })
      .sort({ requestedAt: 1 })
      .lean<DataRequestDocument[]>()
      .exec();
  },

  /** Counts the ones still waiting, for the badge on the clinic's own dashboard. */
  async countOpenByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    return DataRequestModel.countDocuments({ clinicId, status: 'open' }).exec();
  },

  async updateById(
    id: string,
    clinicId: string,
    data: Partial<DataRequestDocument>
  ): Promise<boolean> {
    await mongo.connect();
    const result = await DataRequestModel.updateOne({ _id: id, clinicId }, { $set: data });
    return result.matchedCount > 0;
  },

  /** Purges every row this clinic owns. Only the account-deletion service calls this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await DataRequestModel.deleteMany({ clinicId });
    return result.deletedCount;
  },
};
