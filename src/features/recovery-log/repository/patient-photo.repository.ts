import {
  PatientPhotoDocument,
  PatientPhotoModel,
} from '@/features/recovery-log/schema/patient-photo.schema';
import { mongo } from '@/shared/lib/mongo';

export const patientPhotoRepository = {
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

  /** Purges every row for one patient, clinic-scoped so it can never reach another tenant's. */
  async deleteAllByPatient(patientId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await PatientPhotoModel.deleteMany({ patientId, clinicId });
    return result.deletedCount;
  },
};
