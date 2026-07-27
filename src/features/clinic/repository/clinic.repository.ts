import { ClinicDocument, ClinicModel } from '@/features/clinic/schema/clinic.schema';
import { mongo } from '@/shared/lib/mongo';

export const clinicRepository = {
  async create(data: Omit<ClinicDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await ClinicModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string): Promise<ClinicDocument | null> {
    await mongo.connect();
    return ClinicModel.findById(id).lean<ClinicDocument>().exec();
  },

  async findBySlug(slug: string): Promise<ClinicDocument | null> {
    await mongo.connect();
    return ClinicModel.findOne({ slug }).lean<ClinicDocument>().exec();
  },

  async findByOwnerId(ownerId: string): Promise<ClinicDocument | null> {
    await mongo.connect();
    return ClinicModel.findOne({ ownerId }).lean<ClinicDocument>().exec();
  },

  async updateById(id: string, data: Partial<ClinicDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await ClinicModel.updateOne({ _id: id }, { $set: data });
    return result.matchedCount > 0;
  },

  async deleteById(id: string): Promise<boolean> {
    await mongo.connect();
    const result = await ClinicModel.findByIdAndDelete(id);
    return result !== null;
  },
};
