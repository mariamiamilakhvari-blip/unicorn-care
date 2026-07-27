import { PatientDocument, PatientModel } from '@/features/patient/schema/patient.schema';
import { mongo } from '@/shared/lib/mongo';

/**
 * Tenancy guarantee (PRD 02): every read/write below carries `clinicId` in the filter.
 * There is deliberately no unscoped `findById` for a Patient.
 */
export const patientRepository = {
  async create(data: Omit<PatientDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await PatientModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string, clinicId: string): Promise<PatientDocument | null> {
    await mongo.connect();
    return PatientModel.findOne({ _id: id, clinicId }).lean<PatientDocument>().exec();
  },

  async findAllByClinic(
    clinicId: string,
    page = 1,
    limit = 20
  ): Promise<{ items: PatientDocument[]; total: number }> {
    await mongo.connect();
    const skip = (page - 1) * limit;
    const items = await PatientModel.find({ clinicId }, null, { skip, limit, sort: { lastName: 1 } })
      .lean<PatientDocument[]>()
      .exec();
    const total = await PatientModel.countDocuments({ clinicId }).exec();
    return { items, total };
  },

  async search(clinicId: string, query: string): Promise<PatientDocument[]> {
    await mongo.connect();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return PatientModel.find({
      clinicId,
      $or: [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ],
    })
      .lean<PatientDocument[]>()
      .exec();
  },

  async updateById(id: string, clinicId: string, data: Partial<PatientDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await PatientModel.updateOne({ _id: id, clinicId }, { $set: data });
    return result.matchedCount > 0;
  },

  async archiveById(id: string, clinicId: string): Promise<boolean> {
    await mongo.connect();
    const result = await PatientModel.updateOne({ _id: id, clinicId }, { $set: { isArchived: true } });
    return result.matchedCount > 0;
  },
};
