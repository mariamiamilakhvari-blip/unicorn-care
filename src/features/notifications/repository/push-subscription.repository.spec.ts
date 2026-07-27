import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({ mongo: { connect: vi.fn() } }));

vi.mock('@/features/notifications/schema/push-subscription.schema', () => ({
  PushSubscriptionModel: {
    find: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
  },
}));

import { PushSubscriptionModel } from '@/features/notifications/schema/push-subscription.schema';
import { mongo } from '@/shared/lib/mongo';

import { pushSubscriptionRepository } from './push-subscription.repository';

const mockModel = vi.mocked(PushSubscriptionModel);
const mockMongo = vi.mocked(mongo);

const PATIENT_ID = '507f1f77bcf86cd799439033';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

function leanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

describe('pushSubscriptionRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upsertByEndpoint upserts on the unique endpoint', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ acknowledged: true });
    const data = {
      patientId: PATIENT_ID,
      endpoint: ENDPOINT,
      p256dh: 'key',
      authKey: 'auth',
      userAgent: 'ua',
      locale: 'ka',
      isActive: true,
      failureCount: 0,
      lastSuccessAt: null,
    };
    const result = await pushSubscriptionRepository.upsertByEndpoint(data as never);
    expect(mockMongo.connect).toHaveBeenCalled();
    expect(mockModel.updateOne).toHaveBeenCalledWith({ endpoint: ENDPOINT }, { $set: data }, { upsert: true });
    expect(result).toBe(true);
  });

  it('findActiveByPatient scopes by patient and isActive', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    await pushSubscriptionRepository.findActiveByPatient(PATIENT_ID);
    expect(mockModel.find).toHaveBeenCalledWith({ patientId: PATIENT_ID, isActive: true });
  });

  it('deactivateByEndpoint flips isActive to false (410/404 path)', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    expect(await pushSubscriptionRepository.deactivateByEndpoint(ENDPOINT)).toBe(true);
    expect(mockModel.updateOne).toHaveBeenCalledWith({ endpoint: ENDPOINT }, { $set: { isActive: false } });
  });

  it('deactivateByEndpoint returns false when the endpoint is unknown', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await pushSubscriptionRepository.deactivateByEndpoint('nope')).toBe(false);
  });

  it('deactivateAllForPatient returns the modified count (link revocation path)', async () => {
    (mockModel.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ modifiedCount: 3 });
    const count = await pushSubscriptionRepository.deactivateAllForPatient(PATIENT_ID);
    expect(mockModel.updateMany).toHaveBeenCalledWith(
      { patientId: PATIENT_ID },
      { $set: { isActive: false } }
    );
    expect(count).toBe(3);
  });

  it('incrementFailure bumps failureCount by one', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    await pushSubscriptionRepository.incrementFailure(ENDPOINT);
    expect(mockModel.updateOne).toHaveBeenCalledWith({ endpoint: ENDPOINT }, { $inc: { failureCount: 1 } });
  });

  it('markSuccess resets failureCount and stamps lastSuccessAt', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const at = new Date('2025-05-01T09:00:00Z');
    await pushSubscriptionRepository.markSuccess(ENDPOINT, at);
    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { endpoint: ENDPOINT },
      { $set: { failureCount: 0, lastSuccessAt: at } }
    );
  });
});
