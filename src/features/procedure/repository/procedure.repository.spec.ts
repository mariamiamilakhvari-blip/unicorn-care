import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({ mongo: { connect: vi.fn() } }));

vi.mock('@/features/procedure/schema/procedure.schema', () => ({
  ProcedureModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

import { ProcedureModel } from '@/features/procedure/schema/procedure.schema';
import { mongo } from '@/shared/lib/mongo';

import { procedureRepository } from './procedure.repository';

const mockModel = vi.mocked(ProcedureModel);
const mockMongo = vi.mocked(mongo);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const OTHER_CLINIC_ID = '507f1f77bcf86cd799439022';
const PATIENT_ID = '507f1f77bcf86cd799439033';
const PROCEDURE_ID = '507f1f77bcf86cd799439044';

function leanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

describe('procedureRepository — tenancy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create connects and returns the new id', async () => {
    (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      _id: { toString: () => PROCEDURE_ID },
    });
    expect(await procedureRepository.create({ clinicId: CLINIC_ID } as never)).toBe(PROCEDURE_ID);
    expect(mockMongo.connect).toHaveBeenCalled();
  });

  it('findById includes clinicId in the filter', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    await procedureRepository.findById(PROCEDURE_ID, CLINIC_ID);
    expect(mockModel.findOne).toHaveBeenCalledWith({ _id: PROCEDURE_ID, clinicId: CLINIC_ID });
  });

  it('findAllByPatient includes clinicId in the filter and sorts newest first', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    await procedureRepository.findAllByPatient(PATIENT_ID, CLINIC_ID);
    expect(mockModel.find).toHaveBeenCalledWith({ patientId: PATIENT_ID, clinicId: CLINIC_ID }, null, {
      sort: { performedAt: -1 },
    });
  });

  it('findAllByPatient carries whichever clinicId the caller supplies', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    await procedureRepository.findAllByPatient(PATIENT_ID, OTHER_CLINIC_ID);
    const filter = (mockModel.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(filter).toHaveProperty('clinicId', OTHER_CLINIC_ID);
  });

  it('updateById includes clinicId in the filter', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const result = await procedureRepository.updateById(PROCEDURE_ID, CLINIC_ID, { notes: 'n' });
    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: PROCEDURE_ID, clinicId: CLINIC_ID },
      { $set: { notes: 'n' } }
    );
    expect(result).toBe(true);
  });

  it('updateById returns false for a cross-clinic id', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await procedureRepository.updateById(PROCEDURE_ID, OTHER_CLINIC_ID, {})).toBe(false);
  });
});
