import { FileDocument, FileModel } from '@/features/file/schema/file.schema';
import { mongo } from '@/shared/lib/mongo';

export const fileRepository = {
  async findPage(skip: number, limit: number): Promise<{ items: FileDocument[]; total: number }> {
    await mongo.connect();
    const [items, total] = await Promise.all([
      FileModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<FileDocument[]>().exec(),
      FileModel.countDocuments({}).exec(),
    ]);
    return { items, total };
  },

  async findById(id: string): Promise<FileDocument | null> {
    await mongo.connect();
    return FileModel.findById(id).lean<FileDocument>().exec();
  },

  async create(data: Omit<FileDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await FileModel.create(data);
    return doc._id.toString();
  },

  async updateById(id: string, data: Partial<FileDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await FileModel.findByIdAndUpdate(id, { $set: data });
    return result !== null;
  },

  async deleteById(id: string): Promise<boolean> {
    await mongo.connect();
    const result = await FileModel.findByIdAndDelete(id);
    return result !== null;
  },
};
