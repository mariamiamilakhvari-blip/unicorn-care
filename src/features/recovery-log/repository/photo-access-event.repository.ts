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
  outcome: 'served' | 'denied';
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
};
