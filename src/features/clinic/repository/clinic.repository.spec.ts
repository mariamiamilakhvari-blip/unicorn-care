import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({ mongo: { connect: vi.fn() } }));

vi.mock('@/features/clinic/schema/clinic.schema', () => ({
  ClinicModel: {
    create: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

import { ClinicModel } from '@/features/clinic/schema/clinic.schema';
import { mongo } from '@/shared/lib/mongo';

import { clinicRepository } from './clinic.repository';

const mockModel = vi.mocked(ClinicModel);
const mockMongo = vi.mocked(mongo);

const fakeClinic = { _id: '507f1f77bcf86cd799439011', name: 'Unicorn Clinic', slug: 'unicorn' };

function leanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

describe('clinicRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create connects and returns the new id as a string', async () => {
    (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      _id: { toString: () => '507f1f77bcf86cd799439011' },
    });
    const id = await clinicRepository.create({
      name: 'Unicorn Clinic',
      slug: 'unicorn',
    } as never);
    expect(mockMongo.connect).toHaveBeenCalled();
    expect(id).toBe('507f1f77bcf86cd799439011');
  });

  it('findById delegates to findById', async () => {
    (mockModel.findById as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(fakeClinic));
    const result = await clinicRepository.findById('507f1f77bcf86cd799439011');
    expect(mockModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(result).toEqual(fakeClinic);
  });

  it('findBySlug filters on slug', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(fakeClinic));
    await clinicRepository.findBySlug('unicorn');
    expect(mockModel.findOne).toHaveBeenCalledWith({ slug: 'unicorn' });
  });

  it('findByOwnerId filters on ownerId', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    const result = await clinicRepository.findByOwnerId('507f1f77bcf86cd799439099');
    expect(mockModel.findOne).toHaveBeenCalledWith({ ownerId: '507f1f77bcf86cd799439099' });
    expect(result).toBeNull();
  });

  it('updateById returns true when a document matched', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const result = await clinicRepository.updateById('507f1f77bcf86cd799439011', { city: 'Tbilisi' });
    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011' },
      { $set: { city: 'Tbilisi' } }
    );
    expect(result).toBe(true);
  });

  it('updateById returns false when nothing matched', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await clinicRepository.updateById('missing', { city: 'X' })).toBe(false);
  });

  it('deleteById returns false when nothing was deleted', async () => {
    (mockModel.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    expect(await clinicRepository.deleteById('missing')).toBe(false);
  });
});
