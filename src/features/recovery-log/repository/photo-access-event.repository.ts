import { Types } from 'mongoose';

import {
  PhotoAccessEventDocument,
  PhotoAccessEventModel,
} from '@/features/recovery-log/schema/photo-access-event.schema';
import { mongo } from '@/shared/lib/mongo';

export type PhotoAccessEventInput = {
  photoId: Types.ObjectId;
  patientId: Types.ObjectId | null;
  clinicId: Types.ObjectId | null;
  viewerType: 'clinic_user' | 'patient';
  viewerUserId: Types.ObjectId | null;
  outcome: 'served' | 'denied' | 'deleted';
  reason: string;
  viewedAt: Date;
};

export const photoAccessEventRepository = {
  async create(data: PhotoAccessEventInput): Promise<string> {
    await mongo.connect();
    const doc = await PhotoAccessEventModel.create(data);
    return doc._id.toString();
  },

  async findByPhoto(photoId: string, limit: number): Promise<PhotoAccessEventDocument[]> {
    await mongo.connect();
    return PhotoAccessEventModel.find({ photoId })
      .sort({ viewedAt: -1 })
      .limit(limit)
      .lean<PhotoAccessEventDocument[]>()
      .exec();
  },

  /** Purges every row this clinic owns. Only the cascade-deletion services call this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await PhotoAccessEventModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

  /** Purges every row for one patient, scoped to their clinic so it can never reach another's. */
  async deleteAllByPatient(patientId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await PhotoAccessEventModel.deleteMany({ patientId, clinicId });
    return result.deletedCount;
  },
};
