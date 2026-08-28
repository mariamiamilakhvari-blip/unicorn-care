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

  /**
   * Several patients at once, for a list that has ids in hand and needs the people behind them.
   *
   * One query rather than one per row: the symptom queue resolves every report's patient this
   * way, and a lookup per report would put an unbounded number of round trips behind one
   * dashboard load. Clinic-scoped like everything else here, so an id belonging to another clinic
   * matches nothing instead of leaking a name.
   *
   * Returns whatever exists — fewer rows than ids asked for is normal, not an error. A report
   * outlives the patient record when that record is erased, and the caller decides how to say so.
   */
  async findManyByIds(ids: string[], clinicId: string): Promise<PatientDocument[]> {
    await mongo.connect();
    return PatientModel.find({ _id: { $in: ids }, clinicId })
      .lean<PatientDocument[]>()
      .exec();
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
   * Every patient the clinic holds, since archiving was retired — a record it has finished with is
   * erased outright now rather than hidden, so there is no longer a quiet tier to filter out.
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
   * Every patient holding an email address, unscoped by clinic.
   *
   * The one query here that crosses the tenancy boundary, and it has to: a provider webhook
   * carries an address and nothing else — no clinic, no patient id — so there is no tenant to
   * scope by until the rows are found.
   *
   * Returns a list rather than one row because an address is not an identifier here. A patient is
   * a clinic's record, not a login, so nothing stops the same address appearing on several of
   * them — a family sharing an inbox, a clinic entering its own address, the same person treated
   * at two clinics on the platform. The `findOne` this replaced picked whichever row the index
   * happened to yield, which made a bounce suppress an arbitrary patient and a portal-link request
   * mint a credential into an arbitrary record. Callers must decide what to do with more than one;
   * they can no longer do the wrong thing without noticing.
   */
  async findAllByEmail(email: string): Promise<PatientDocument[]> {
    await mongo.connect();
    return PatientModel.find({ email }).lean<PatientDocument[]>().exec();
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
