import mongoose from 'mongoose';

import { ReminderOccurrenceModel } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { ClinicModel } from '@/features/clinic/schema/clinic.schema';
import { PatientModel } from '@/features/patient/schema/patient.schema';
import { mongo } from '@/shared/lib/mongo';

export type CountBucket = { _id: string | null; count: number };

export type DeliveryCounts = {
  /** Rows the sweep dispatched in the window, whatever became of them. */
  dispatched: number;
  pushAttempted: number;
  pushDelivered: number;
  emailAttempted: number;
  emailDelivered: number;
};

/**
 * Aggregation over the whole platform, unscoped by clinic — the admin console is the only caller,
 * and `adminGuard` is what stands in front of it. Every method takes `clinicId` explicitly when
 * it needs one; nothing here reads a session.
 *
 * These are pipelines, not business decisions: the window, the rate arithmetic and the
 * hours-saved estimate all live in the service, because a repository that starts dividing counts
 * is a repository nobody can reuse for a different report.
 */
export const analyticsRepository = {
  /** Clinics the console offers, id and name only — this list feeds a picker, not a report. */
  async listClinics(): Promise<{ _id: mongoose.Types.ObjectId; name: string }[]> {
    await mongo.connect();
    return ClinicModel.find({}, { name: 1 }).sort({ name: 1 }).lean<
      { _id: mongoose.Types.ObjectId; name: string }[]
    >().exec();
  },

  /**
   * Patients on the books at the end of the window.
   *
   * Counted by `createdAt <= to` rather than by activity: a patient added in Q1 and still not
   * archived is on the clinic's books in Q3, whether or not they had a reminder that quarter.
   * Archived patients are excluded outright — "active" is the question being asked.
   */
  async countActivePatients(clinicId: string, to: Date): Promise<number> {
    await mongo.connect();
    return PatientModel.countDocuments({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      isArchived: false,
      createdAt: { $lte: to },
    }).exec();
  },

  /** Patients added inside the window, which is the number that shows growth rather than size. */
  async countNewPatients(clinicId: string, from: Date, to: Date): Promise<number> {
    await mongo.connect();
    return PatientModel.countDocuments({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      createdAt: { $gte: from, $lte: to },
    }).exec();
  },

  /** Language split across the clinic's non-archived patients. */
  async countPatientsByLocale(clinicId: string, to: Date): Promise<CountBucket[]> {
    await mongo.connect();
    return PatientModel.aggregate<CountBucket>([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          isArchived: false,
          createdAt: { $lte: to },
        },
      },
      { $group: { _id: '$locale', count: { $sum: 1 } } },
    ]).exec();
  },

  /**
   * Reminder outcomes in the window, bucketed by status.
   *
   * Windowed on `dueAt`, not `sentAt` or `createdAt`: the question a quarterly report answers is
   * "what was this clinic's plan asking of its patients in these three months", and a row
   * generated in June for an August dose belongs to Q3.
   */
  async countOccurrencesByStatus(
    clinicId: string,
    from: Date,
    to: Date
  ): Promise<CountBucket[]> {
    await mongo.connect();
    return ReminderOccurrenceModel.aggregate<CountBucket>([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          dueAt: { $gte: from, $lte: to },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();
  },

  /**
   * Delivery outcomes per channel.
   *
   * `pushDelivered`/`emailDelivered` are `null` on rows dispatched before they were recorded, so
   * "attempted" counts only the rows where the field is a real boolean. That keeps an untracked
   * quarter reporting as *no data* rather than as a total failure.
   */
  async countDeliveries(clinicId: string, from: Date, to: Date): Promise<DeliveryCounts> {
    await mongo.connect();
    const [result] = await ReminderOccurrenceModel.aggregate<DeliveryCounts>([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          dueAt: { $gte: from, $lte: to },
          status: { $in: ['sent', 'done', 'skipped', 'missed'] },
        },
      },
      {
        $group: {
          _id: null,
          dispatched: { $sum: 1 },
          pushAttempted: { $sum: { $cond: [{ $eq: [{ $type: '$pushDelivered' }, 'bool'] }, 1, 0] } },
          pushDelivered: { $sum: { $cond: [{ $eq: ['$pushDelivered', true] }, 1, 0] } },
          emailAttempted: {
            $sum: { $cond: [{ $eq: [{ $type: '$emailDelivered' }, 'bool'] }, 1, 0] },
          },
          emailDelivered: { $sum: { $cond: [{ $eq: ['$emailDelivered', true] }, 1, 0] } },
        },
      },
    ]).exec();

    return (
      result ?? {
        dispatched: 0,
        pushAttempted: 0,
        pushDelivered: 0,
        emailAttempted: 0,
        emailDelivered: 0,
      }
    );
  },
};
