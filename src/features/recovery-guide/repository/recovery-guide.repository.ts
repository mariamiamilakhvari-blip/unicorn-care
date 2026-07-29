import { Types } from 'mongoose';

import {
  RecoveryGuideDocument,
  RecoveryGuideModel,
} from '@/features/recovery-guide/schema/recovery-guide.schema';
import { WarningSeverity } from '@/shared/const/recovery.const';
import { mongo } from '@/shared/lib/mongo';
import { AppLocale } from '@/shared/types/roles';

/**
 * The plain shape a write accepts.
 *
 * Declared literally rather than as `Omit<RecoveryGuideDocument, …>`: `InferSchemaType` types
 * subdocument arrays as Mongoose's hydrated `DocumentArray`, which no plain object literal can
 * satisfy. Spelling out the input keeps callers free of Mongoose types and needs no casts.
 */
export type RecoveryGuideInput = {
  clinicId: Types.ObjectId | null;
  manipulationType: string;
  locale: AppLocale;
  expected: Array<{ title: string; description: string; fromDay: number; toDay: number }>;
  warning: Array<{ title: string; description: string; severity: WarningSeverity }>;
  updatedByUserId: Types.ObjectId | null;
  isPublished: boolean;
};

export const recoveryGuideRepository = {
  async create(data: RecoveryGuideInput): Promise<string> {
    await mongo.connect();
    const doc = await RecoveryGuideModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string, clinicId: string): Promise<RecoveryGuideDocument | null> {
    await mongo.connect();
    return RecoveryGuideModel.findOne({ _id: id, clinicId })
      .lean<RecoveryGuideDocument>()
      .exec();
  },

  async findAllByClinic(clinicId: string): Promise<RecoveryGuideDocument[]> {
    await mongo.connect();
    return RecoveryGuideModel.find({ clinicId }, null, { sort: { manipulationType: 1 } })
      .lean<RecoveryGuideDocument[]>()
      .exec();
  },

  async findForClinic(
    clinicId: string,
    manipulationType: string,
    locale: AppLocale
  ): Promise<RecoveryGuideDocument | null> {
    await mongo.connect();
    return RecoveryGuideModel.findOne({ clinicId, manipulationType, locale })
      .lean<RecoveryGuideDocument>()
      .exec();
  },

  /** Platform defaults carry a null `clinicId` and are readable by every clinic. */
  async findDefault(
    manipulationType: string,
    locale: AppLocale
  ): Promise<RecoveryGuideDocument | null> {
    await mongo.connect();
    return RecoveryGuideModel.findOne({ clinicId: null, manipulationType, locale })
      .lean<RecoveryGuideDocument>()
      .exec();
  },

  async updateById(
    id: string,
    clinicId: string,
    data: Partial<RecoveryGuideInput>
  ): Promise<boolean> {
    await mongo.connect();
    const result = await RecoveryGuideModel.updateOne({ _id: id, clinicId }, { $set: data });
    return result.matchedCount > 0;
  },

  async deleteById(id: string, clinicId: string): Promise<boolean> {
    await mongo.connect();
    const result = await RecoveryGuideModel.findOneAndDelete({ _id: id, clinicId });
    return result !== null;
  },
  /** Purges every row this clinic owns. Only the account-deletion service calls this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await RecoveryGuideModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

};
