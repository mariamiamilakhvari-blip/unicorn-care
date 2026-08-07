import { UserDocument, UserModel } from '@/features/auth/schema/user.schema';
import { mongo } from '@/shared/lib/mongo';

/**
 * What the admin list narrows by. Spelled out rather than imported: Mongoose 9 no longer exports
 * `FilterQuery`, and naming the two shapes that are actually passed is more honest than widening
 * the parameter to accept any query at all.
 */
export type UserFilter = {
  $or?: ({ name: RegExp } | { email: RegExp })[];
};

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

  /**
   * The admin console's user list: one page of rows plus the total the page was taken from.
   *
   * `filter` is built by the service — a repository runs queries and makes no decisions about
   * what to search for. Sorted newest first so a freshly registered clinic is at the top, which
   * is what an admin is usually looking for.
   */
  async findPage(
    filter: UserFilter,
    skip: number,
    limit: number
  ): Promise<{ items: UserDocument[]; total: number }> {
    await mongo.connect();
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<UserDocument[]>().exec(),
      UserModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  },

  /** How many accounts hold a role. Guards the last-admin check. */
  async countByRole(role: string): Promise<number> {
    await mongo.connect();
    return UserModel.countDocuments({ role, isActive: true }).exec();
  },

  async create(
    data: Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt' | 'isActive'> & {
      /* Defaulted by the schema; every caller but the admin console leaves it alone. */
      isActive?: boolean;
    }
  ): Promise<string> {
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
  /** Removes every staff login belonging to a clinic. Account deletion only. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await UserModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

};
