import {
  SymptomReportDocument,
  SymptomReportModel,
} from '@/features/recovery-guide/schema/symptom-report.schema';
import { SymptomReportStatus } from '@/shared/const/recovery.const';
import { mongo } from '@/shared/lib/mongo';

export type SymptomReportInput = Omit<SymptomReportDocument, '_id' | 'createdAt' | 'updatedAt'>;

export const symptomReportRepository = {
  async create(data: SymptomReportInput): Promise<string> {
    await mongo.connect();
    const doc = await SymptomReportModel.create(data);
    return doc._id.toString();
  },

  async findAllByClinic(
    clinicId: string,
    status?: SymptomReportStatus
  ): Promise<SymptomReportDocument[]> {
    await mongo.connect();
    const filter = status ? { clinicId, status } : { clinicId };
    return SymptomReportModel.find(filter, null, { sort: { createdAt: -1 } })
      .lean<SymptomReportDocument[]>()
      .exec();
  },

  async findByPatient(patientId: string): Promise<SymptomReportDocument[]> {
    await mongo.connect();
    return SymptomReportModel.find({ patientId }, null, { sort: { createdAt: -1 } })
      .lean<SymptomReportDocument[]>()
      .exec();
  },

  async countOpenForClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    return SymptomReportModel.countDocuments({ clinicId, status: 'needs_review' }).exec();
  },

  async updateById(
    id: string,
    clinicId: string,
    data: Partial<SymptomReportInput>
  ): Promise<boolean> {
    await mongo.connect();
    const result = await SymptomReportModel.updateOne({ _id: id, clinicId }, { $set: data });
    return result.matchedCount > 0;
  },

  /** Purges every row this clinic owns. Only the cascade-deletion services call this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await SymptomReportModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

  /** Purges every row for one patient, scoped to their clinic so it can never reach another's. */
  async deleteAllByPatient(patientId: string, clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await SymptomReportModel.deleteMany({ patientId, clinicId });
    return result.deletedCount;
  },
};
