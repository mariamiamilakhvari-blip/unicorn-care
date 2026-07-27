import {
  PushSubscriptionDocument,
  PushSubscriptionModel,
} from '@/features/notifications/schema/push-subscription.schema';
import { mongo } from '@/shared/lib/mongo';

export type PushSubscriptionInput = Omit<
  PushSubscriptionDocument,
  '_id' | 'createdAt' | 'updatedAt'
>;

/**
 * Push subscriptions belong to a patient, not to a clinic — the schema carries no `clinicId`
 * (PRD 01 §8). Callers reach them through `patientGuard` or through a clinic-scoped patient
 * lookup, so `patientId` is the scope.
 */
export const pushSubscriptionRepository = {
  async upsertByEndpoint(data: PushSubscriptionInput): Promise<boolean> {
    await mongo.connect();
    const result = await PushSubscriptionModel.updateOne(
      { endpoint: data.endpoint },
      { $set: data },
      { upsert: true }
    );
    return result.acknowledged;
  },

  async findActiveByPatient(patientId: string): Promise<PushSubscriptionDocument[]> {
    await mongo.connect();
    return PushSubscriptionModel.find({ patientId, isActive: true })
      .lean<PushSubscriptionDocument[]>()
      .exec();
  },

  async deactivateByEndpoint(endpoint: string): Promise<boolean> {
    await mongo.connect();
    const result = await PushSubscriptionModel.updateOne(
      { endpoint },
      { $set: { isActive: false } }
    );
    return result.matchedCount > 0;
  },

  async deactivateAllForPatient(patientId: string): Promise<number> {
    await mongo.connect();
    const result = await PushSubscriptionModel.updateMany(
      { patientId },
      { $set: { isActive: false } }
    );
    return result.modifiedCount;
  },

  async incrementFailure(endpoint: string): Promise<boolean> {
    await mongo.connect();
    const result = await PushSubscriptionModel.updateOne(
      { endpoint },
      { $inc: { failureCount: 1 } }
    );
    return result.matchedCount > 0;
  },

  async markSuccess(endpoint: string, lastSuccessAt: Date): Promise<boolean> {
    await mongo.connect();
    const result = await PushSubscriptionModel.updateOne(
      { endpoint },
      { $set: { failureCount: 0, lastSuccessAt } }
    );
    return result.matchedCount > 0;
  },
};
