import mongoose from 'mongoose';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/rating/repository/rating.repository', () => ({
  ratingRepository: {
    aggregatePublicClinics: vi.fn(),
    aggregatePublicDoctors: vi.fn(),
  },
}));

import { ratingRepository } from '@/features/rating/repository/rating.repository';
import { PublicRatingsView } from '@/features/rating/types/rating.types';
import { MIN_RATINGS_FOR_AVERAGE } from '@/shared/const/rating.const';

import { getPublicRatingsService } from './public-rating.service';

const ratings = vi.mocked(ratingRepository);

const CLINIC_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

function view(data: unknown): PublicRatingsView {
  if (data && typeof data === 'object' && 'error' in data) throw new Error('expected a view');
  return data as PublicRatingsView;
}

beforeEach(() => {
  vi.clearAllMocks();
  ratings.aggregatePublicClinics.mockResolvedValue([]);
  ratings.aggregatePublicDoctors.mockResolvedValue([]);
});

describe('getPublicRatingsService — what may be published', () => {
  /*
    The threshold governs what a clinic sees about itself, and a public ranking is where it matters
    most: the board sorts on the number, so a 5.0 from one happy patient would top it.
  */
  it('asks for nothing below the average threshold', async () => {
    await getPublicRatingsService();

    expect(ratings.aggregatePublicClinics).toHaveBeenCalledWith(
      MIN_RATINGS_FOR_AVERAGE,
      expect.any(Number)
    );
    expect(ratings.aggregatePublicDoctors).toHaveBeenCalledWith(
      MIN_RATINGS_FOR_AVERAGE,
      expect.any(Number)
    );
  });

  it('reports the threshold so the page can say what the figures rest on', async () => {
    const { data } = await getPublicRatingsService();
    expect(view(data).threshold).toBe(MIN_RATINGS_FOR_AVERAGE);
  });

  /*
    The tenancy boundary on this route is the shape of the payload, not a filter — there is no
    session to scope by. Nothing that could identify a patient may survive the mapping.
  */
  it('publishes no patient-identifying field on any board', async () => {
    ratings.aggregatePublicClinics.mockResolvedValue([
      { _id: CLINIC_ID, name: 'Gagua', ratingCount: 9, avgClinicScore: 4.6, avgDoctorScore: 4.4 },
    ]);
    ratings.aggregatePublicDoctors.mockResolvedValue([
      {
        _id: { clinicId: CLINIC_ID, operatorName: 'Dr Nino' },
        clinicName: 'Gagua',
        ratingCount: 7,
        avgDoctorScore: 4.9,
      },
    ]);

    const { data } = await getPublicRatingsService();
    const serialised = JSON.stringify(view(data));

    for (const leaked of ['patientId', 'patientName', 'procedureId', 'clinicId']) {
      expect(serialised).not.toContain(leaked);
    }
  });

  /**
   * The payload carries no free text at all now. Published reviews were the one field that could
   * re-identify somebody in a small clinic — a sentence plus a clinic name is often enough — and
   * they needed their own consent flag to be safe. The rating form no longer collects a comment,
   * so this asserts the shape rather than the flag: numbers and clinic names, nothing else.
   */
  it('carries no free text on any board', async () => {
    ratings.aggregatePublicClinics.mockResolvedValue([
      { _id: CLINIC_ID, name: 'Gagua', ratingCount: 9, avgClinicScore: 4.6, avgDoctorScore: 4.4 },
    ]);

    const { data } = await getPublicRatingsService();

    expect(view(data)).not.toHaveProperty('reviews');
    expect(JSON.stringify(view(data))).not.toContain('comment');
  });
});

describe('getPublicRatingsService — presentation', () => {
  it('rounds averages to the one decimal the scale can support', async () => {
    ratings.aggregatePublicClinics.mockResolvedValue([
      {
        _id: CLINIC_ID,
        name: 'Gagua',
        ratingCount: 6,
        avgClinicScore: 4.6666666,
        avgDoctorScore: 3.333333,
      },
    ]);

    const { data } = await getPublicRatingsService();

    expect(view(data).clinics[0].avgClinicScore).toBe(4.7);
    expect(view(data).clinics[0].avgDoctorScore).toBe(3.3);
  });

  it('carries the doctor name off the grouping key, not off a staff account', async () => {
    ratings.aggregatePublicDoctors.mockResolvedValue([
      {
        _id: { clinicId: CLINIC_ID, operatorName: 'Dr Nino Kechakmadze' },
        clinicName: 'Gold Esthetic',
        ratingCount: 8,
        avgDoctorScore: 4.75,
      },
    ]);

    const { data } = await getPublicRatingsService();

    expect(view(data).doctors[0]).toMatchObject({
      name: 'Dr Nino Kechakmadze',
      clinicName: 'Gold Esthetic',
      avgDoctorScore: 4.8,
    });
  });

  it('answers with empty boards rather than an error when nothing qualifies', async () => {
    const { data, status } = await getPublicRatingsService();

    expect(status).toBe(200);
    expect(view(data).clinics).toEqual([]);
    expect(view(data).doctors).toEqual([]);
  });
});
