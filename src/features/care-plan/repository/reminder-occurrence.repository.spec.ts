import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/mongo', () => ({ mongo: { connect: vi.fn() } }));

vi.mock('@/features/care-plan/schema/reminder-occurrence.schema', () => ({
  ReminderOccurrenceModel: {
    insertMany: vi.fn(),
    deleteMany: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  },
}));

import { ReminderOccurrenceModel } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { mongo } from '@/shared/lib/mongo';

import { reminderOccurrenceRepository } from './reminder-occurrence.repository';

const mockModel = vi.mocked(ReminderOccurrenceModel);
const mockMongo = vi.mocked(mongo);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const OTHER_CLINIC_ID = '507f1f77bcf86cd799439022';
const PATIENT_ID = '507f1f77bcf86cd799439033';
const PLAN_ID = '507f1f77bcf86cd799439055';
const OCCURRENCE_ID = '507f1f77bcf86cd799439066';

function leanQuery<T>(result: T) {
  return { lean: () => ({ exec: () => Promise.resolve(result) }) };
}

describe('reminderOccurrenceRepository — tenancy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('insertMany connects and returns the inserted count', async () => {
    (mockModel.insertMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{}, {}, {}]);
    expect(await reminderOccurrenceRepository.insertMany([] as never)).toBe(3);
    expect(mockMongo.connect).toHaveBeenCalled();
  });

  it('deletePendingByCarePlan includes clinicId and never touches sent/done history', async () => {
    (mockModel.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ deletedCount: 7 });
    const count = await reminderOccurrenceRepository.deletePendingByCarePlan(PLAN_ID, CLINIC_ID);
    expect(mockModel.deleteMany).toHaveBeenCalledWith({
      carePlanId: PLAN_ID,
      clinicId: CLINIC_ID,
      status: 'pending',
    });
    expect(count).toBe(7);
  });

  it('deletePendingByCarePlan carries the caller clinicId', async () => {
    (mockModel.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ deletedCount: 0 });
    await reminderOccurrenceRepository.deletePendingByCarePlan(PLAN_ID, OTHER_CLINIC_ID);
    const filter = (mockModel.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(filter).toHaveProperty('clinicId', OTHER_CLINIC_ID);
  });

  it('findDueForDispatch is cron-scoped and windows dueAt between now-sinceHours and now', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    const now = new Date('2025-05-01T12:00:00Z');
    await reminderOccurrenceRepository.findDueForDispatch(now, 6, 500);
    const [filter, projection, options] = (mockModel.find as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(filter.status).toBe('pending');
    expect(filter.dueAt.$lte).toEqual(now);
    expect(filter.dueAt.$gte).toEqual(new Date('2025-05-01T06:00:00Z'));
    expect(filter).not.toHaveProperty('clinicId');
    expect(projection).toBeNull();
    expect(options).toEqual({ sort: { dueAt: 1 }, limit: 500 });
  });

  it('findByPatientAndRange scopes by patientId — the portal tenancy boundary', async () => {
    (mockModel.find as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery([]));
    const from = new Date('2025-05-01T00:00:00Z');
    const to = new Date('2025-05-01T23:59:59Z');
    await reminderOccurrenceRepository.findByPatientAndRange(PATIENT_ID, from, to);
    expect(mockModel.find).toHaveBeenCalledWith(
      { patientId: PATIENT_ID, dueAt: { $gte: from, $lte: to } },
      null,
      { sort: { dueAt: 1 } }
    );
  });

  it('findByIdForPatient requires the occurrence to belong to the patient', async () => {
    (mockModel.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce(leanQuery(null));
    const result = await reminderOccurrenceRepository.findByIdForPatient(OCCURRENCE_ID, PATIENT_ID);
    expect(mockModel.findOne).toHaveBeenCalledWith({ _id: OCCURRENCE_ID, patientId: PATIENT_ID });
    expect(result).toBeNull();
  });

  it('updateStatus sets only the status patch fields', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 1 });
    const completedAt = new Date('2025-05-01T09:05:00Z');
    const result = await reminderOccurrenceRepository.updateStatus(OCCURRENCE_ID, {
      status: 'done',
      completedAt,
    });
    expect(mockModel.updateOne).toHaveBeenCalledWith(
      { _id: OCCURRENCE_ID },
      { $set: { status: 'done', completedAt } }
    );
    expect(result).toBe(true);
  });

  it('updateStatus returns false when nothing matched', async () => {
    (mockModel.updateOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await reminderOccurrenceRepository.updateStatus('gone', { status: 'sent' })).toBe(false);
  });

  it('markMissedBefore is cron-scoped and only transitions pending rows', async () => {
    (mockModel.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ modifiedCount: 4 });
    const cutoff = new Date('2025-05-01T06:00:00Z');
    const count = await reminderOccurrenceRepository.markMissedBefore(cutoff);
    expect(mockModel.updateMany).toHaveBeenCalledWith(
      { status: 'pending', dueAt: { $lt: cutoff } },
      { $set: { status: 'missed' } }
    );
    expect(count).toBe(4);
  });

  it('countByStatusForPlan matches on clinicId and casts ids to ObjectId for the pipeline', async () => {
    (mockModel.aggregate as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      exec: () => Promise.resolve([{ _id: 'done', count: 2 }]),
    });
    const result = await reminderOccurrenceRepository.countByStatusForPlan(PLAN_ID, CLINIC_ID);
    const pipeline = (mockModel.aggregate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pipeline[0].$match.carePlanId.toString()).toBe(PLAN_ID);
    expect(pipeline[0].$match.clinicId.toString()).toBe(CLINIC_ID);
    expect(result).toEqual([{ _id: 'done', count: 2 }]);
  });
});
