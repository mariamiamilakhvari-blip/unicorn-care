import { Types } from 'mongoose';

import { ProcedureDocument, ProcedureModel } from '@/features/procedure/schema/procedure.schema';
import { mongo } from '@/shared/lib/mongo';

/** One row per operating surgeon, as returned by the grouping pipeline below. */
export type OperatorAggregate = {
  _id: string;
  displayName: string;
  procedureCount: number;
  patientIds: Types.ObjectId[];
  manipulationTypes: string[];
  lastPerformedAt: Date;
};

/** Tenancy guarantee (PRD 02): every read/write carries `clinicId` in the filter. */
export const procedureRepository = {
  async create(data: Omit<ProcedureDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await ProcedureModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string, clinicId: string): Promise<ProcedureDocument | null> {
    await mongo.connect();
    return ProcedureModel.findOne({ _id: id, clinicId }).lean<ProcedureDocument>().exec();
  },

  async findAllByPatient(patientId: string, clinicId: string): Promise<ProcedureDocument[]> {
    await mongo.connect();
    return ProcedureModel.find({ patientId, clinicId }, null, { sort: { performedAt: -1 } })
      .lean<ProcedureDocument[]>()
      .exec();
  },

  /**
   * Groups a clinic's procedures by operating surgeon.
   *
   * The doctor list is derived from what the clinic already logs on each procedure — nobody
   * maintains a second roster by hand, and a surgeon cannot be missing from the list while having
   * operated. Grouping is on a trimmed, lowercased key so "Dr. Nino" and "dr. nino " are one
   * person; the most recent spelling is kept for display.
   */
  async aggregateByOperator(clinicId: string): Promise<OperatorAggregate[]> {
    await mongo.connect();
    return ProcedureModel.aggregate<OperatorAggregate>([
      { $match: { clinicId: new Types.ObjectId(clinicId) } },
      { $sort: { performedAt: -1 } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$operatorName' } } },
          displayName: { $first: { $trim: { input: '$operatorName' } } },
          procedureCount: { $sum: 1 },
          patientIds: { $addToSet: '$patientId' },
          manipulationTypes: { $addToSet: '$manipulationType' },
          lastPerformedAt: { $max: '$performedAt' },
        },
      },
      { $sort: { lastPerformedAt: -1 } },
    ]).exec();
  },

  async deleteById(id: string, clinicId: string): Promise<boolean> {
    await mongo.connect();
    const result = await ProcedureModel.findOneAndDelete({ _id: id, clinicId });
    return result !== null;
  },

  async updateById(
    id: string,
    clinicId: string,
    data: Partial<ProcedureDocument>
  ): Promise<boolean> {
    await mongo.connect();
    const result = await ProcedureModel.updateOne({ _id: id, clinicId }, { $set: data });
    return result.matchedCount > 0;
  },
  /** Purges every row this clinic owns. Only the account-deletion service calls this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await ProcedureModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

};
