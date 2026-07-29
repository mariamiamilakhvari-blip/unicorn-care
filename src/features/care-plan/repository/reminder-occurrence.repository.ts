import mongoose from 'mongoose';

import {
  ReminderOccurrenceDocument,
  ReminderOccurrenceInput,
  ReminderOccurrenceModel,
} from '@/features/care-plan/schema/reminder-occurrence.schema';
import { mongo } from '@/shared/lib/mongo';

const MS_PER_HOUR = 60 * 60 * 1000;

export type ReminderStatusCount = { _id: ReminderOccurrenceDocument['status']; count: number };

export type ReminderStatusPatch = Partial<
  Pick<ReminderOccurrenceDocument, 'status' | 'sentAt' | 'completedAt'>
>;

/**
 * Tenancy (PRD 02): staff-facing reads carry `clinicId`. Patient-portal reads carry `patientId`,
 * which the caller must take from `patientGuard` (a validated, revocable access token) and never
 * from a query param — that is the portal's tenancy boundary.
 */
export const reminderOccurrenceRepository = {
  async insertMany(docs: ReminderOccurrenceInput[]): Promise<number> {
    await mongo.connect();
    const inserted = await ReminderOccurrenceModel.insertMany(docs);
    return inserted.length;
  },

  /**
   * Every occurrence belonging to a plan, whatever its date.
   *
   * Listing by date range was hiding checkup reminders that fall after `rehabEndsAt` — the row
   * existed but never reached the UI. Scoping by the plan removes the assumption that a plan's
   * reminders all sit inside its rehab window.
   */
  async findByCarePlan(
    carePlanId: string,
    clinicId: string
  ): Promise<ReminderOccurrenceDocument[]> {
    await mongo.connect();
    return ReminderOccurrenceModel.find({ carePlanId, clinicId }, null, { sort: { dueAt: 1 } })
      .lean<ReminderOccurrenceDocument[]>()
      .exec();
  },

  /** Every row for a plan, whatever its status — used when the plan itself is removed. */
  async deleteAllByCarePlan(carePlanId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await ReminderOccurrenceModel.deleteMany({ carePlanId, clinicId });
    return result.deletedCount;
  },

  async deletePendingByCarePlan(carePlanId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await ReminderOccurrenceModel.deleteMany({
      carePlanId,
      clinicId,
      status: 'pending',
    });
    return result.deletedCount;
  },

  /**
   * Cron-scoped — deliberately NOT clinic-scoped. The dispatch sweep runs as the platform under
   * `CRON_SECRET`, so there is no clinic session to scope by (PRD 04 §"The sweep").
   */
  async findDueForDispatch(
    now: Date,
    sinceHours: number,
    limit: number
  ): Promise<ReminderOccurrenceDocument[]> {
    await mongo.connect();
    const since = new Date(now.getTime() - sinceHours * MS_PER_HOUR);
    return ReminderOccurrenceModel.find({ status: 'pending', dueAt: { $lte: now, $gte: since } }, null, {
      sort: { dueAt: 1 },
      limit,
    })
      .lean<ReminderOccurrenceDocument[]>()
      .exec();
  },

  /**
   * Takes exclusive ownership of the given rows for one dispatch run.
   *
   * `status: 'pending'` stays in the filter so this is a compare-and-set: MongoDB applies each
   * document update atomically, so when two runs race on the same row exactly one moves it out of
   * `pending` and the loser matches nothing. `modifiedCount` is therefore what this run actually
   * won, not what it asked for.
   */
  async claimForDispatch(ids: string[], claimId: string, claimedAt: Date): Promise<number> {
    await mongo.connect();
    const result = await ReminderOccurrenceModel.updateMany(
      { _id: { $in: ids }, status: 'pending' },
      { $set: { status: 'sending', claimId, claimedAt } }
    );
    return result.modifiedCount;
  },

  async findByClaimId(claimId: string): Promise<ReminderOccurrenceDocument[]> {
    await mongo.connect();
    return ReminderOccurrenceModel.find({ claimId, status: 'sending' }, null, {
      sort: { dueAt: 1 },
    })
      .lean<ReminderOccurrenceDocument[]>()
      .exec();
  },

  /**
   * Returns rows abandoned mid-send to `pending` so a later run retries them.
   *
   * Without this a run that dies between claiming and sending would strand its rows in `sending`
   * for good, and the patient would silently never be reminded.
   */
  async releaseStaleClaims(cutoff: Date): Promise<number> {
    await mongo.connect();
    const result = await ReminderOccurrenceModel.updateMany(
      { status: 'sending', claimedAt: { $lt: cutoff } },
      { $set: { status: 'pending', claimId: null, claimedAt: null } }
    );
    return result.modifiedCount;
  },

  async findByPatientAndRange(
    patientId: string,
    from: Date,
    to: Date
  ): Promise<ReminderOccurrenceDocument[]> {
    await mongo.connect();
    return ReminderOccurrenceModel.find({ patientId, dueAt: { $gte: from, $lte: to } }, null, {
      sort: { dueAt: 1 },
    })
      .lean<ReminderOccurrenceDocument[]>()
      .exec();
  },

  async findByIdForPatient(
    id: string,
    patientId: string
  ): Promise<ReminderOccurrenceDocument | null> {
    await mongo.connect();
    return ReminderOccurrenceModel.findOne({ _id: id, patientId })
      .lean<ReminderOccurrenceDocument>()
      .exec();
  },

  async updateStatus(id: string, data: ReminderStatusPatch): Promise<boolean> {
    await mongo.connect();
    const result = await ReminderOccurrenceModel.updateOne({ _id: id }, { $set: data });
    return result.matchedCount > 0;
  },

  /**
   * Cron-scoped — deliberately NOT clinic-scoped, same reason as `findDueForDispatch`.
   * Anything still pending more than the grace window past `dueAt` becomes `missed` (PRD 03 §4).
   */
  async markMissedBefore(cutoff: Date): Promise<number> {
    await mongo.connect();
    const result = await ReminderOccurrenceModel.updateMany(
      { status: 'pending', dueAt: { $lt: cutoff } },
      { $set: { status: 'missed' } }
    );
    return result.modifiedCount;
  },

  async countByStatusForPlan(
    carePlanId: string,
    clinicId: string
  ): Promise<ReminderStatusCount[]> {
    await mongo.connect();
    // Aggregation pipelines are not cast by Mongoose — ids must be real ObjectIds to match.
    return ReminderOccurrenceModel.aggregate<ReminderStatusCount>([
      {
        $match: {
          carePlanId: new mongoose.Types.ObjectId(carePlanId),
          clinicId: new mongoose.Types.ObjectId(clinicId),
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();
  },
};
