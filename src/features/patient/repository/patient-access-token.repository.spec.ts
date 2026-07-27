import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({ mongo: { connect: vi.fn() } }));

vi.mock('@/features/patient/schema/patient-access-token.schema', () => ({
  PatientAccessTokenModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
  },
}));

import { PatientAccessTokenModel } from '@/features/patient/schema/patient-access-token.schema';
import { mongo } from '@/shared/lib/mongo';

import { patientAccessTokenRepository } from './patient-access-token.repository';

const mockModel = vi.mocked(PatientAccessTokenModel);
const mockMongo = vi.mocked(mongo);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const PATIENT_ID = '507f1f77bcf86cd799439033';
const TOKEN_HASH = 'a'.repeat(64);

function leanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

describe('patientAccessTokenRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create connects and returns the new id', async () => {
    (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      _id: { toString: () => 'tok1' },
    });
    expect(await patientAccessTokenRepository.create({ tokenHash: TOKEN_HASH } as never)).toBe('tok1');
    expect(mockMongo.connect).toHaveBeenCalled();
  });

  it('findByTokenHash looks up by hash only — the token itself is the credential', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    await patientAccessTokenRepository.findByTokenHash(TOKEN_HASH);
    expect(mockModel.findOne).toHaveBeenCalledWith({ tokenHash: TOKEN_HASH });
  });

  it('revokeAllForPatient scopes by patientId AND clinicId and only touches live tokens', async () => {
    (mockModel.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ modifiedCount: 2 });
    const revokedAt = new Date('2025-01-01T00:00:00Z');
    const count = await patientAccessTokenRepository.revokeAllForPatient(PATIENT_ID, CLINIC_ID, revokedAt);
    expect(mockModel.updateMany).toHaveBeenCalledWith(
      { patientId: PATIENT_ID, clinicId: CLINIC_ID, revokedAt: null },
      { $set: { revokedAt } }
    );
    expect(count).toBe(2);
  });

  it('touchLastUsed updates only the given token row', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const at = new Date('2025-02-02T10:00:00Z');
    expect(await patientAccessTokenRepository.touchLastUsed('tok1', at)).toBe(true);
    expect(mockModel.updateOne).toHaveBeenCalledWith({ _id: 'tok1' }, { $set: { lastUsedAt: at } });
  });

  it('touchLastUsed returns false when the row is gone', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await patientAccessTokenRepository.touchLastUsed('gone', new Date())).toBe(false);
  });

  it('findActiveByPatient scopes by clinicId', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    await patientAccessTokenRepository.findActiveByPatient(PATIENT_ID, CLINIC_ID);
    expect(mockModel.find).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      revokedAt: null,
    });
  });
});
