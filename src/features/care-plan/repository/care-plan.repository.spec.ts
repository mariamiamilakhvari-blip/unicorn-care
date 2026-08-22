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

/**
 * P5 — the digest read was `find({ status: 'active' }, null, { limit })` with no sort, so MongoDB
 * returned natural order and every sweep saw the same first `limit` documents. Once those were
 * claimed for the day the remaining 1400-odd sweeps did nothing, and any plan past the limit never
 * received a daily digest at all: no error, no counter, for as long as it stayed active.
 */
describe('carePlanRepository — digest fairness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('orders by lastDigestOn so the limit is a batch and not a wall', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));

    await carePlanRepository.findActiveForDigest(200);

    expect(mockModel.find).toHaveBeenCalledWith({ status: 'active' }, null, {
      limit: 200,
      sort: { lastDigestOn: 1 },
    });
  });

  /*
    `lastDigestOn` is a `YYYY-MM-DD` string and plans that have never had a digest carry `''`, so
    ascending order puts the longest-waiting first and today's already-sent plans last. That is the
    property that drains a backlog rather than re-reading the front of it.
  */
  it('sorts ascending, so never-sent and longest-waiting plans come first', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));

    await carePlanRepository.findActiveForDigest(200);

    const [, , options] = (mockModel.find as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.sort.lastDigestOn).toBe(1);
  });
});
