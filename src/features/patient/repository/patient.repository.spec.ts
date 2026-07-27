import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({ mongo: { connect: vi.fn() } }));

vi.mock('@/features/patient/schema/patient.schema', () => ({
  PatientModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(),
  },
}));

import { PatientModel } from '@/features/patient/schema/patient.schema';
import { mongo } from '@/shared/lib/mongo';

import { patientRepository } from './patient.repository';

const mockModel = vi.mocked(PatientModel);
const mockMongo = vi.mocked(mongo);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const OTHER_CLINIC_ID = '507f1f77bcf86cd799439022';
const PATIENT_ID = '507f1f77bcf86cd799439033';

function leanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

function execQuery<T>(result: T) {
  return { exec: () => Promise.resolve(result) };
}

describe('patientRepository — tenancy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('findById scopes the filter by clinicId', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    await patientRepository.findById(PATIENT_ID, CLINIC_ID);
    expect(mockMongo.connect).toHaveBeenCalled();
    expect(mockModel.findOne).toHaveBeenCalledWith({ _id: PATIENT_ID, clinicId: CLINIC_ID });
  });

  it('findById cannot reach another clinic — the clinicId in the filter is the caller\'s', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    await patientRepository.findById(PATIENT_ID, OTHER_CLINIC_ID);
    const filter = (mockModel.findOne as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(filter).toHaveProperty('clinicId', OTHER_CLINIC_ID);
  });

  it('findAllByClinic scopes both the page query and the count', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    (mockModel.countDocuments as ReturnType<typeof vi.fn>).mockReturnValueOnce(execQuery(0));
    await patientRepository.findAllByClinic(CLINIC_ID, 2, 10);
    expect(mockModel.find).toHaveBeenCalledWith({ clinicId: CLINIC_ID }, null, {
      skip: 10,
      limit: 10,
      sort: { lastName: 1 },
    });
    expect(mockModel.countDocuments).toHaveBeenCalledWith({ clinicId: CLINIC_ID });
  });

  it('findAllByClinic defaults to page 1 limit 20', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    (mockModel.countDocuments as ReturnType<typeof vi.fn>).mockReturnValueOnce(execQuery(3));
    const result = await patientRepository.findAllByClinic(CLINIC_ID);
    expect(mockModel.find).toHaveBeenCalledWith(
      { clinicId: CLINIC_ID },
      null,
      expect.objectContaining({ skip: 0, limit: 20 })
    );
    expect(result.total).toBe(3);
  });

  it('search scopes by clinicId and matches name or phone', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    await patientRepository.search(CLINIC_ID, 'beri');
    const filter = (mockModel.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(filter.clinicId).toBe(CLINIC_ID);
    expect(filter.$or).toEqual([
      { firstName: { $regex: 'beri', $options: 'i' } },
      { lastName: { $regex: 'beri', $options: 'i' } },
      { phone: { $regex: 'beri', $options: 'i' } },
    ]);
  });

  it('search escapes regex metacharacters in the query', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    await patientRepository.search(CLINIC_ID, 'a.*b');
    const filter = (mockModel.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(filter.$or[0].firstName.$regex).toBe('a\\.\\*b');
  });

  it('updateById scopes the filter by clinicId', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const result = await patientRepository.updateById(PATIENT_ID, CLINIC_ID, { notes: 'x' });
    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: PATIENT_ID, clinicId: CLINIC_ID },
      { $set: { notes: 'x' } }
    );
    expect(result).toBe(true);
  });

  it('updateById returns false when the patient belongs to another clinic', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await patientRepository.updateById(PATIENT_ID, OTHER_CLINIC_ID, { notes: 'x' })).toBe(false);
  });

  it('archiveById scopes the filter by clinicId and sets isArchived', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    await patientRepository.archiveById(PATIENT_ID, CLINIC_ID);
    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: PATIENT_ID, clinicId: CLINIC_ID },
      { $set: { isArchived: true } }
    );
  });

  it('create connects and returns the new id', async () => {
    (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      _id: { toString: () => PATIENT_ID },
    });
    expect(await patientRepository.create({ clinicId: CLINIC_ID } as never)).toBe(PATIENT_ID);
  });

  it('every read/write method receives a clinicId argument', () => {
    expect(patientRepository.findById.length).toBeGreaterThanOrEqual(2);
    expect(patientRepository.search.length).toBeGreaterThanOrEqual(2);
    expect(patientRepository.updateById.length).toBeGreaterThanOrEqual(3);
    expect(patientRepository.archiveById.length).toBeGreaterThanOrEqual(2);
  });
});
