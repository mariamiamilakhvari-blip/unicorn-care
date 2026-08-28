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
  warning: Array<{
    title: string;
    description: string;
    severity: WarningSeverity;
    fromDay: number;
    toDay: number;
  }>;
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

  /**
   * Inserts a platform default if that slot is empty, and otherwise leaves it entirely alone.
   *
   * Every field goes in `$setOnInsert`, which is the whole point: seeding runs more than once —
   * on deploy, by hand, after a new procedure type is added — and by then a clinician may have
   * corrected the draft or published it. A `$set` would silently overwrite reviewed clinical
   * content with the generic text it replaced, and unpublish it. Returns true only on insert.
   */
  async upsertDefault(data: RecoveryGuideInput): Promise<boolean> {
    await mongo.connect();
    const result = await RecoveryGuideModel.updateOne(
      { clinicId: null, manipulationType: data.manipulationType, locale: data.locale },
      { $setOnInsert: data },
      { upsert: true }
    );
    return result.upsertedCount > 0;
  },

  /** Every platform default, for the admin review queue. Null `clinicId` keeps clinics out. */
  async findAllDefaults(): Promise<RecoveryGuideDocument[]> {
    await mongo.connect();
    return RecoveryGuideModel.find({ clinicId: null }, null, {
      sort: { manipulationType: 1, locale: 1 },
    })
      .lean<RecoveryGuideDocument[]>()
      .exec();
  },

  /**
   * One platform default by id.
   *
   * `clinicId: null` is part of the match rather than a check on the result, so an admin handing
   * this the id of a clinic's own guide gets nothing back instead of that clinic's content.
   */
  async findDefaultById(id: string): Promise<RecoveryGuideDocument | null> {
    await mongo.connect();
    return RecoveryGuideModel.findOne({ _id: id, clinicId: null })
      .lean<RecoveryGuideDocument>()
      .exec();
  },

  /**
   * Sets the publication state of a platform default, and nothing else about it.
   *
   * Scoped to `clinicId: null` for the reason above: a clinic's guide is published by the clinic
   * that wrote it, through its own editor, and an admin route that could flip that flag would let
   * the platform put its name on — or take down — clinical text it did not author.
   */
  async setDefaultPublished(id: string, isPublished: boolean): Promise<boolean> {
    await mongo.connect();
    const result = await RecoveryGuideModel.updateOne(
      { _id: id, clinicId: null },
      { $set: { isPublished } }
    );
    return result.matchedCount > 0;
  },

  /**
   * Rewrites the content of a platform default that already exists, leaving its publication state
   * alone. Matches on a null `clinicId`, so it can only ever touch platform rows.
   *
   * Separate from `upsertDefault` and never called by it, because the two protect different
   * things. That one must not overwrite; this one exists precisely to, and only for content the
   * platform owns: a clinic editing a default does not edit the default, it creates its own row
   * under its own `clinicId` — see `upsertGuideService`. `isPublished` is deliberately not in the
   * `$set`: whether a draft has been reviewed is a fact about a human, not about the text.
   */
  async refreshDefault(data: RecoveryGuideInput): Promise<boolean> {
    await mongo.connect();
    const result = await RecoveryGuideModel.updateOne(
      { clinicId: null, manipulationType: data.manipulationType, locale: data.locale },
      { $set: { expected: data.expected, warning: data.warning } }
    );
    return result.matchedCount > 0;
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
