import mongoose from 'mongoose';

import { RatingDocument, RatingModel } from '@/features/rating/schema/rating.schema';
import { mongo } from '@/shared/lib/mongo';

export type RatingAggregate = {
  ratingCount: number;
  avgDoctorScore: number;
  avgClinicScore: number;
};

/** One clinic's public standing, as the aggregation returns it. */
export type PublicClinicAggregate = {
  _id: mongoose.Types.ObjectId;
  name: string;
  ratingCount: number;
  avgClinicScore: number;
  avgDoctorScore: number;
};

/**
 * One doctor's standing inside a single clinic, for that clinic's own dashboard.
 *
 * Grouped on the operating surgeon's *name* rather than `operatorUserId`, for the same reason the
 * public board is: the roster is derived from what is written on each procedure, and
 * `operatorUserId` is null for a visiting surgeon or anyone without a staff account. Grouping on
 * the account id would drop those doctors from a clinic's own view of itself.
 */
export type ClinicDoctorAggregate = {
  _id: string;
  ratingCount: number;
  avgDoctorScore: number;
};

/**
 * One doctor's public standing.
 *
 * Keyed by clinic *and* name because a doctor is not a record here — `listDoctorsService` derives
 * the roster from the operating surgeon written on each procedure, and `operatorUserId` is null
 * for anyone without a staff account. Grouping on the account id alone would silently drop every
 * visiting or unregistered surgeon from the board.
 */
export type PublicDoctorAggregate = {
  _id: { clinicId: mongoose.Types.ObjectId; operatorName: string };
  clinicName: string;
  ratingCount: number;
  avgDoctorScore: number;
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

  /**
   * Every doctor at one clinic, with the average their own patients gave them.
   *
   * Clinic-scoped in the `$match` that runs *first*, so the pipeline can never see another
   * tenant's ratings — the scope is not something a later stage filters back out.
   *
   * No minimum applies here and that is deliberate: the threshold exists so a clinic is not ranked
   * publicly on two ratings, and a clinic looking at its own doctors is not being ranked. It is
   * told the count beside each average and can judge for itself.
   */
  async aggregateDoctorsForClinic(clinicId: string): Promise<ClinicDoctorAggregate[]> {
    await mongo.connect();
    return RatingModel.aggregate<ClinicDoctorAggregate>([
      { $match: { clinicId: new mongoose.Types.ObjectId(clinicId) } },
      {
        $lookup: {
          from: 'procedures',
          localField: 'procedureId',
          foreignField: '_id',
          as: 'procedure',
        },
      },
      { $unwind: '$procedure' },
      {
        $group: {
          _id: '$procedure.operatorName',
          ratingCount: { $sum: 1 },
          avgDoctorScore: { $avg: '$doctorScore' },
        },
      },
      // Ties broken by volume, as the public board does: more ratings is the stronger average.
      { $sort: { avgDoctorScore: -1, ratingCount: -1 } },
    ]).exec();
  },

  /**
   * Clinics ranked by their patients' scores, for the public board.
   *
   * `minRatings` and `limit` are the caller's — the threshold below which an average must not be
   * published is a business rule and lives in the service (CLAUDE.md §8).
   */
  async aggregatePublicClinics(
    minRatings: number,
    limit: number
  ): Promise<PublicClinicAggregate[]> {
    await mongo.connect();
    return RatingModel.aggregate<PublicClinicAggregate>([
      {
        $group: {
          _id: '$clinicId',
          ratingCount: { $sum: 1 },
          avgClinicScore: { $avg: '$clinicScore' },
          avgDoctorScore: { $avg: '$doctorScore' },
        },
      },
      { $match: { ratingCount: { $gte: minRatings } } },
      { $lookup: { from: 'clinics', localField: '_id', foreignField: '_id', as: 'clinic' } },
      { $unwind: '$clinic' },
      { $set: { name: '$clinic.name' } },
      { $unset: 'clinic' },
      // Ties broken by volume: between two clinics at 4.8, the one with more ratings is the safer
      // recommendation, because its average is standing on more evidence.
      { $sort: { avgClinicScore: -1, ratingCount: -1 } },
      { $limit: limit },
    ]).exec();
  },

  /**
   * Doctors ranked by their patients' scores.
   *
   * Joined through the procedure rather than read off the rating: a rating carries
   * `operatorUserId`, which is null for a surgeon with no staff account, while the procedure
   * always carries `operatorName`. The join is what keeps those doctors on the board.
   */
  async aggregatePublicDoctors(
    minRatings: number,
    limit: number
  ): Promise<PublicDoctorAggregate[]> {
    await mongo.connect();
    return RatingModel.aggregate<PublicDoctorAggregate>([
      {
        $lookup: {
          from: 'procedures',
          localField: 'procedureId',
          foreignField: '_id',
          as: 'procedure',
        },
      },
      { $unwind: '$procedure' },
      {
        $group: {
          _id: { clinicId: '$clinicId', operatorName: '$procedure.operatorName' },
          ratingCount: { $sum: 1 },
          avgDoctorScore: { $avg: '$doctorScore' },
        },
      },
      { $match: { ratingCount: { $gte: minRatings } } },
      { $lookup: { from: 'clinics', localField: '_id.clinicId', foreignField: '_id', as: 'clinic' } },
      { $unwind: '$clinic' },
      { $set: { clinicName: '$clinic.name' } },
      { $unset: 'clinic' },
      { $sort: { avgDoctorScore: -1, ratingCount: -1 } },
      { $limit: limit },
    ]).exec();
  },

  /** Purged with the rest of a clinic's records on account deletion. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await RatingModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

  /** Purges every row for one patient, clinic-scoped so it can never reach another tenant's. */
  async deleteAllByPatient(patientId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await RatingModel.deleteMany({ patientId, clinicId });
    return result.deletedCount;
  },
};
