import { Types } from 'mongoose';

import {
  PatientPhotoDocument,
  PatientPhotoModel,
} from '@/features/recovery-log/schema/patient-photo.schema';
import { mongo } from '@/shared/lib/mongo';

export type PatientPhotoInput = {
  patientId: Types.ObjectId;
  clinicId: Types.ObjectId;
  recoveryLogId: Types.ObjectId | null;
  pathname: string;
  contentType: string;
  size: number;
  consent: { version: string; grantedAt: Date };
  uploadedAt: Date;
  uploadedBy: 'patient' | 'clinic';
};

export const patientPhotoRepository = {
  async create(data: PatientPhotoInput): Promise<string> {
    await mongo.connect();
    const doc = await PatientPhotoModel.create(data);
    return doc._id.toString();
  },

  /**
   * Unscoped by clinic on purpose. Both a clinic user and the patient themselves may read a
   * photo, and they are authorised on different fields, so the comparison belongs in the service
   * where both cases are visible together — not split across two repository methods that each
   * look correct alone.
   */
  async findById(id: string): Promise<PatientPhotoDocument | null> {
    await mongo.connect();
    return PatientPhotoModel.findById(id).lean<PatientPhotoDocument>().exec();
  },

  async findByPatient(patientId: string, clinicId: string): Promise<PatientPhotoDocument[]> {
    await mongo.connect();
    return PatientPhotoModel.find({ patientId, clinicId })
      .sort({ uploadedAt: -1 })
      .lean<PatientPhotoDocument[]>()
      .exec();
  },

  async deleteById(id: string): Promise<boolean> {
    await mongo.connect();
    const result = await PatientPhotoModel.findByIdAndDelete(id);
    return result !== null;
  },

  /** Pathnames only — the account-deletion path needs them to remove the bytes as well as the rows. */
  async findAllByClinic(clinicId: string): Promise<PatientPhotoDocument[]> {
    await mongo.connect();
    return PatientPhotoModel.find({ clinicId }).lean<PatientPhotoDocument[]>().exec();
  },

  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await PatientPhotoModel.deleteMany({ clinicId });
    return result.deletedCount;
  },
};
