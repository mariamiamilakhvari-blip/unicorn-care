import { Types } from 'mongoose';

import {
  RecoveryLogDocument,
  RecoveryLogModel,
} from '@/features/recovery-log/schema/recovery-log.schema';
import { MoodLevel, SwellingLevel } from '@/shared/const/recovery-log.const';
import { mongo } from '@/shared/lib/mongo';

export type RecoveryLogInput = {
  patientId: Types.ObjectId;
  clinicId: Types.ObjectId;
  carePlanId: Types.ObjectId;
  loggedAt: Date;
  dayIndex: number;
  painLevel: number;
  swelling: SwellingLevel;
  mood: MoodLevel | null;
  note: string;
  photoIds: Types.ObjectId[];
};

export const recoveryLogRepository = {
  async create(data: RecoveryLogInput): Promise<string> {
    await mongo.connect();
    const doc = await RecoveryLogModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string): Promise<RecoveryLogDocument | null> {
    await mongo.connect();
    return RecoveryLogModel.findById(id).lean<RecoveryLogDocument>().exec();
  },

  /** One patient's curve, oldest first — the order the chart plots. */
  async findByPatient(patientId: string, clinicId: string): Promise<RecoveryLogDocument[]> {
    await mongo.connect();
    return RecoveryLogModel.find({ patientId, clinicId })
      .sort({ dayIndex: 1 })
      .lean<RecoveryLogDocument[]>()
      .exec();
  },

  /** The uniqueness rule's read side: has this day already been reported? */
  async findByPlanAndDay(carePlanId: string, dayIndex: number): Promise<RecoveryLogDocument | null> {
    await mongo.connect();
    return RecoveryLogModel.findOne({ carePlanId, dayIndex })
      .lean<RecoveryLogDocument>()
      .exec();
  },

  async updateById(id: string, data: Partial<RecoveryLogInput>): Promise<boolean> {
    await mongo.connect();
    const result = await RecoveryLogModel.updateOne({ _id: id }, { $set: data });
    return result.matchedCount > 0;
  },

  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await RecoveryLogModel.deleteMany({ clinicId });
    return result.deletedCount;
  },
};
