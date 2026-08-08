import mongoose from 'mongoose';

import { RatingDocument, RatingModel } from '@/features/rating/schema/rating.schema';
import { mongo } from '@/shared/lib/mongo';

export type RatingAggregate = {
  ratingCount: number;
  avgDoctorScore: number;
  avgClinicScore: number;
};

export const ratingRepository = {
  async create(data: Omit<RatingDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await RatingModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string): Promise<RatingDocument | null> {
    await mongo.connect();
    return RatingModel.findById(id).lean<RatingDocument>().exec();
  },

  /** One per procedure — the uniqueness rule's read side. */
  async findByProcedure(procedureId: string): Promise<RatingDocument | null> {
    await mongo.connect();
    return RatingModel.findOne({ procedureId }).lean<RatingDocument>().exec();
  },

  async findByClinic(clinicId: string, limit: number): Promise<RatingDocument[]> {
    await mongo.connect();
    return RatingModel.find({ clinicId })
      .sort({ submittedAt: -1 })
      .limit(limit)
      .lean<RatingDocument[]>()
      .exec();
  },

  async updateById(id: string, data: Partial<RatingDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await RatingModel.updateOne({ _id: id }, { $set: data });
    return result.matchedCount > 0;
  },

  /**
   * Recomputes a clinic's averages from its ratings.
   *
   * Read back from the ratings rather than folded into a running total: an incremental average
   * drifts as soon as one write is lost or replayed, and there is no way to notice. A clinic has
   * tens of ratings, not millions, so recomputing costs nothing.
   */
  async aggregateForClinic(clinicId: string): Promise<RatingAggregate> {
    await mongo.connect();
    const [result] = await RatingModel.aggregate<RatingAggregate>([
      { $match: { clinicId: new mongoose.Types.ObjectId(clinicId) } },
      {
        $group: {
          _id: null,
          ratingCount: { $sum: 1 },
          avgDoctorScore: { $avg: '$doctorScore' },
          avgClinicScore: { $avg: '$clinicScore' },
        },
      },
    ]).exec();

    return result ?? { ratingCount: 0, avgDoctorScore: 0, avgClinicScore: 0 };
  },

  /** Purged with the rest of a clinic's records on account deletion. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await RatingModel.deleteMany({ clinicId });
    return result.deletedCount;
  },
};
