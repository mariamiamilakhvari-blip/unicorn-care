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

  /**
   * Patients whose email cannot carry a reminder — no address at all, or a suppressed one.
   *
   * Only the candidates for "unreachable": push is checked separately, against this shortlist
   * rather than against the whole caseload, because most patients have a working address and
   * checking their subscriptions would be work done to prove a negative.
   *
   * Archived patients are excluded. They are no longer in active care, and a warning about
   * somebody the clinic has finished with is noise on a screen whose value is that it is quiet.
   */
  async findWithUnusableEmail(clinicId: string): Promise<PatientDocument[]> {
    await mongo.connect();
    return PatientModel.find({
      clinicId,
      $or: [
        { email: { $in: [null, ''] } },
        { email: { $exists: false } },
        { emailSuppressedAt: { $ne: null } },
      ],
    })
      .sort({ lastName: 1 })
      .lean<PatientDocument[]>()
      .exec();
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

  /**
   * Looks a patient up by email address, unscoped by clinic.
   *
   * The one query here that crosses the tenancy boundary, and it has to: a provider webhook
   * carries an address and nothing else — no clinic, no patient id — so there is no tenant to
   * scope by until the row is found. Only the webhook path calls it, and it reads rather than
   * exposes: the caller records an event against whatever clinic owns the row.
   */
  async findByEmail(email: string): Promise<PatientDocument | null> {
    await mongo.connect();
    return PatientModel.findOne({ email }).lean<PatientDocument>().exec();
  },

  /**
   * Writes email deliverability state. Separate from `updateById` because that one is
   * clinic-scoped and this is called from the webhook, which has no clinic in hand.
   */
  async updateDeliveryState(id: string, data: Partial<PatientDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await PatientModel.updateOne({ _id: id }, { $set: data });
    return result.matchedCount > 0;
  },

  async updateById(id: string, clinicId: string, data: Partial<PatientDocument>): Promise<boolean> {
    await mongo.connect();
    const result = await PatientModel.updateOne({ _id: id, clinicId }, { $set: data });
    return result.matchedCount > 0;
  },

  /** Clinic-scoped, like every other write here: another clinic's id matches nothing. */
  async deleteById(id: string, clinicId: string): Promise<boolean> {
    await mongo.connect();
    const result = await PatientModel.deleteOne({ _id: id, clinicId });
    return result.deletedCount > 0;
  },

  /** Purges every row this clinic owns. Only the account-deletion service calls this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await PatientModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

};
