import { EmailEventDocument, EmailEventModel } from '@/features/notifications/schema/email-event.schema';
import { mongo } from '@/shared/lib/mongo';

export const emailEventRepository = {
  async create(data: Omit<EmailEventDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await mongo.connect();
    const doc = await EmailEventModel.create(data);
    return doc._id.toString();
  },

  /**
   * Whether this provider event has already been recorded.
   *
   * Webhook delivery is at-least-once: Resend retries anything it does not get a 2xx for, and a
   * timeout on our side means a duplicate arrives even though the first was processed. Without
   * this, one bounce could increment the soft-bounce count several times and suppress an address
   * that bounced once.
   */
  async existsByProviderId(providerId: string): Promise<boolean> {
    await mongo.connect();
    const found = await EmailEventModel.exists({ providerId });
    return found !== null;
  },

  /** A patient's delivery history, newest first — what the clinic reads to decide what to fix. */
  async findByPatient(
    patientId: string,
    clinicId: string,
    limit: number
  ): Promise<EmailEventDocument[]> {
    await mongo.connect();
    return EmailEventModel.find({ patientId, clinicId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean<EmailEventDocument[]>()
      .exec();
  },

  /** Purged with the rest of a clinic's records on account deletion. */
  async deleteAllByClinic(clinicId: string): Promise<number> {
    await mongo.connect();
    const result = await EmailEventModel.deleteMany({ clinicId });
    return result.deletedCount;
  },
};
