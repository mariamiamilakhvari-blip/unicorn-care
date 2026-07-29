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
  async findActiveForDigest(limit: number): Promise<CarePlanDocument[]> {
    await mongo.connect();
    return CarePlanModel.find({ status: 'active' }, null, { limit })
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
