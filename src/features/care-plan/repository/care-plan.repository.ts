import {
  CarePlanDocument,
  CarePlanInput,
  CarePlanModel,
} from '@/features/care-plan/schema/care-plan.schema';
import { mongo } from '@/shared/lib/mongo';

/** Tenancy guarantee (PRD 02): every staff-facing read/write carries `clinicId` in the filter. */
export const carePlanRepository = {
  async create(data: CarePlanInput): Promise<string> {
    await mongo.connect();
    const doc = await CarePlanModel.create(data);
    return doc._id.toString();
  },

  async findById(id: string, clinicId: string): Promise<CarePlanDocument | null> {
    await mongo.connect();
    return CarePlanModel.findOne({ _id: id, clinicId }).lean<CarePlanDocument>().exec();
  },

  async findByProcedureId(procedureId: string, clinicId: string): Promise<CarePlanDocument | null> {
    await mongo.connect();
    return CarePlanModel.findOne({ procedureId, clinicId }).lean<CarePlanDocument>().exec();
  },

  async findActiveByPatient(patientId: string, clinicId: string): Promise<CarePlanDocument[]> {
    await mongo.connect();
    return CarePlanModel.find({ patientId, clinicId, status: 'active' })
      .lean<CarePlanDocument[]>()
      .exec();
  },

  /**
   * Every plan this patient has ever had, whatever its status.
   *
   * Distinct from `findActiveByPatient` because the data subject access right is a right to the
   * whole record, not to the part still in force — a patient asking what is held about them is
   * usually asking about the course of treatment that finished.
   */
  async findAllByPatient(patientId: string, clinicId: string): Promise<CarePlanDocument[]> {
    await mongo.connect();
    return CarePlanModel.find({ patientId, clinicId })
      .sort({ startsAt: 1 })
      .lean<CarePlanDocument[]>()
      .exec();
  },

  async deleteById(id: string, clinicId: string): Promise<boolean> {
    await mongo.connect();
    const result = await CarePlanModel.findOneAndDelete({ _id: id, clinicId });
    return result !== null;
  },

  async updateById(
    id: string,
    clinicId: string,
    data: Partial<CarePlanInput>
  ): Promise<boolean> {
    await mongo.connect();
    const result = await CarePlanModel.updateOne({ _id: id, clinicId }, { $set: data });
    return result.matchedCount > 0;
  },

  /**
   * Cron-scoped — deliberately NOT clinic-scoped.
   *
   * The rolling-extension sweep (PRD 04 §7) runs as the platform, not as a clinic session, so
   * there is no `clinicId` to scope by. It returns every still-running active plan across all
   * tenants whose rehab window extends past `beforeDate`; the caller compares each plan against
   * its already-generated occurrence horizon and extends the ones that need it. The only caller
   * is `/api/cron/dispatch-reminders`, which is authorised by `CRON_SECRET` and never reachable
   * from a clinic or patient session.
   */
  /**
   * Cron-scoped — deliberately NOT clinic-scoped, like the dispatch sweep. The digest runs as the
   * platform under `CRON_SECRET` and has no clinic session.
   */
  /**
   * The next plans owed a daily digest, least-recently-sent first.
   *
   * The sort is what makes the limit a batch rather than a wall. Unsorted, MongoDB returns natural
   * order, so every sweep saw the same first `limit` documents: once those were claimed for the
   * day the remaining sweeps did nothing, and any plan past the limit never received a digest at
   * all — silently, with no error and no counter, for as long as it stayed active.
   *
   * `lastDigestOn` is a `YYYY-MM-DD` string, so ascending order puts plans that have gone longest
   * without an email at the front; a plan already sent today sorts last and is skipped by the
   * per-patient date check anyway. Plans that have never had one carry `''` and sort first.
   */
  async findActiveForDigest(limit: number): Promise<CarePlanDocument[]> {
    await mongo.connect();
    return CarePlanModel.find({ status: 'active' }, null, { limit, sort: { lastDigestOn: 1 } })
      .lean<CarePlanDocument[]>()
      .exec();
  },

  /**
   * Takes today's digest for one plan. `lastDigestOn: { $ne: localDate }` makes it a compare-and-set
   * that MongoDB applies atomically, so when two sweeps overlap exactly one wins and the patient
   * receives one email rather than two.
   */
  async claimDigest(id: string, localDate: string): Promise<boolean> {
    await mongo.connect();
    const result = await CarePlanModel.updateOne(
      { _id: id, lastDigestOn: { $ne: localDate } },
      { $set: { lastDigestOn: localDate } }
    );
    return result.modifiedCount > 0;
  },

  /**
   * Retires plans whose rehabilitation window has closed.
   *
   * `completed` has been in the schema since the beginning and nothing ever set it, so every plan
   * ever activated stayed `active` for good. That left finished plans being swept for extension
   * and dispatch forever, and gave the rating flow no moment to fire on.
   */
  async completeFinishedPlans(now: Date): Promise<number> {
    await mongo.connect();
    const result = await CarePlanModel.updateMany(
      { status: 'active', rehabEndsAt: { $lte: now } },
      { $set: { status: 'completed' } }
    );
    return result.modifiedCount;
  },

  /** Plans a patient may now rate: finished, and belonging to them. */
  async findCompletedByPatient(patientId: string): Promise<CarePlanDocument[]> {
    await mongo.connect();
    return CarePlanModel.find({ patientId, status: 'completed' })
      .sort({ rehabEndsAt: -1 })
      .lean<CarePlanDocument[]>()
      .exec();
  },

  async findActivePlansNeedingExtension(beforeDate: Date): Promise<CarePlanDocument[]> {
    await mongo.connect();
    return CarePlanModel.find({ status: 'active', rehabEndsAt: { $gt: beforeDate } })
      .lean<CarePlanDocument[]>()
      .exec();
  },
  /** Purges every row this clinic owns. Only the account-deletion service calls this. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await CarePlanModel.deleteMany({ clinicId });
    return result.deletedCount;
  },

};
