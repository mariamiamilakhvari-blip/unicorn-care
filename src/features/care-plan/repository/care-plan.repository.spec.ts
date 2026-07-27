import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({ mongo: { connect: vi.fn() } }));

vi.mock('@/features/care-plan/schema/care-plan.schema', () => ({
  CarePlanModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

import { CarePlanModel } from '@/features/care-plan/schema/care-plan.schema';
import { mongo } from '@/shared/lib/mongo';

import { carePlanRepository } from './care-plan.repository';

const mockModel = vi.mocked(CarePlanModel);
const mockMongo = vi.mocked(mongo);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const OTHER_CLINIC_ID = '507f1f77bcf86cd799439022';
const PATIENT_ID = '507f1f77bcf86cd799439033';
const PROCEDURE_ID = '507f1f77bcf86cd799439044';
const PLAN_ID = '507f1f77bcf86cd799439055';

function leanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

describe('carePlanRepository — tenancy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create connects and returns the new id', async () => {
    (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      _id: { toString: () => PLAN_ID },
    });
    expect(await carePlanRepository.create({ clinicId: CLINIC_ID } as never)).toBe(PLAN_ID);
    expect(mockMongo.connect).toHaveBeenCalled();
  });

  it('findById includes clinicId in the filter', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    await carePlanRepository.findById(PLAN_ID, CLINIC_ID);
    expect(mockModel.findOne).toHaveBeenCalledWith({ _id: PLAN_ID, clinicId: CLINIC_ID });
  });

  it('findByProcedureId includes clinicId in the filter', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    await carePlanRepository.findByProcedureId(PROCEDURE_ID, OTHER_CLINIC_ID);
    expect(mockModel.findOne).toHaveBeenCalledWith({
      procedureId: PROCEDURE_ID,
      clinicId: OTHER_CLINIC_ID,
    });
  });

  it('findActiveByPatient includes clinicId and the active status', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    await carePlanRepository.findActiveByPatient(PATIENT_ID, CLINIC_ID);
    expect(mockModel.find).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      clinicId: CLINIC_ID,
      status: 'active',
    });
  });

  it('updateById includes clinicId in the filter', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const result = await carePlanRepository.updateById(PLAN_ID, CLINIC_ID, { status: 'active' });
    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: PLAN_ID, clinicId: CLINIC_ID },
      { $set: { status: 'active' } }
    );
    expect(result).toBe(true);
  });

  it('updateById returns false for a cross-clinic id', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await carePlanRepository.updateById(PLAN_ID, OTHER_CLINIC_ID, {})).toBe(false);
  });

  it('findActivePlansNeedingExtension is cron-scoped: no clinicId, filters on status and horizon', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    const before = new Date('2025-06-01T00:00:00Z');
    await carePlanRepository.findActivePlansNeedingExtension(before);
    const filter = (mockModel.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(filter).toEqual({ status: 'active', rehabEndsAt: { $gt: before } });
    expect(filter).not.toHaveProperty('clinicId');
  });
});
