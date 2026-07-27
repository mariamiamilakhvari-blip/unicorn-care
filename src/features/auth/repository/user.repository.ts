import { UserDocument, UserModel } from '@/features/auth/schema/user.schema';
import { mongo } from '@/shared/lib/mongo';

export const userRepository = {
  async findById(id: string): Promise<UserDocument | null> {
    await mongo.connect();
    return UserModel.findById(id).lean<UserDocument>().exec();
  },

  async findByEmail(email: string): Promise<UserDocument | null> {
    await mongo.connect();
    return UserModel.findOne({ email }).lean<UserDocument>().exec();
  },

  /** Staff accounts belonging to one clinic — used to match logins onto the derived doctor list. */
  async findAllByClinic(clinicId: string): Promise<UserDocument[]> {
    await mongo.connect();
    return UserModel.find({ clinicId }).lean<UserDocument[]>().exec();
  },

  async findAll(page = 1, limit = 20): Promise<{ items: UserDocument[] }> {
    await mongo.connect();
    const skip = (page - 1) * limit;
    const items = await UserModel.find({}, null, { skip, limit }).lean<UserDocument[]>().exec();
    return { items };
  },

  async create(data: Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await UserModel.create(data);
    return doc._id.toString();
  },

  async updateById(id: string, data: Partial<UserDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await UserModel.findByIdAndUpdate(id, { $set: data });
    return result !== null;
  },

  async updateByEmail(email: string, data: Partial<UserDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await UserModel.updateOne({ email }, { $set: data });
    return result.matchedCount > 0;
  },

  async deleteById(id: string): Promise<boolean> {
    await mongo.connect();
    const result = await UserModel.findByIdAndDelete(id);
    return result !== null;
  },
};
