import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/rating/repository/rating.repository', () => ({
  ratingRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByProcedure: vi.fn(),
    findByClinic: vi.fn(),
    updateById: vi.fn(),
    aggregateForClinic: vi.fn(),
    aggregateDoctorsForClinic: vi.fn(),
  },
}));
vi.mock('@/features/procedure/repository/procedure.repository', () => ({
  procedureRepository: { findById: vi.fn() },
}));
vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { findByProcedureId: vi.fn(), findCompletedByPatient: vi.fn() },
}));
vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { updateById: vi.fn() },
}));
vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { ProcedureDocument } from '@/features/procedure/schema/procedure.schema';
import { ratingRepository } from '@/features/rating/repository/rating.repository';
import { RatingDocument } from '@/features/rating/schema/rating.schema';
import {
  listClinicRatingsService,
  listRatablePlansService,
  respondToRatingService,
  reviseRatingService,
  submitRatingService,
} from '@/features/rating/service/rating.service';
import { MIN_RATINGS_FOR_AVERAGE } from '@/shared/const/rating.const';
import { clock } from '@/shared/lib/clock';

const ratings = vi.mocked(ratingRepository);
const procedures = vi.mocked(procedureRepository);
const plans = vi.mocked(carePlanRepository);
const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);

const PATIENT = '507f1f77bcf86cd799439011';
const CLINIC = '507f1f77bcf86cd799439022';
const PROCEDURE = '507f1f77bcf86cd799439033';
const RATING = '507f1f77bcf86cd799439044';
const OTHER = '507f1f77bcf86cd7994390aa';

const NOW = new Date('2026-08-09T12:00:00.000Z');

const procedure = (patientId = PATIENT): ProcedureDocument =>
  ({
    _id: new mongoose.Types.ObjectId(PROCEDURE),
    patientId: new mongoose.Types.ObjectId(patientId),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    operatorName: 'Gagua',
    operatorUserId: null,
    manipulationType: 'rhinoplasty',
  }) as ProcedureDocument;

const plan = (status: string): CarePlanDocument =>
  ({
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439055'),
    procedureId: new mongoose.Types.ObjectId(PROCEDURE),
    rehabEndsAt: new Date('2026-08-01T00:00:00.000Z'),
    status,
  }) as CarePlanDocument;

const rating = (over: Partial<RatingDocument> = {}): RatingDocument =>
  ({
    _id: new mongoose.Types.ObjectId(RATING),
    patientId: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    procedureId: new mongoose.Types.ObjectId(PROCEDURE),
    doctorScore: 4,
    clinicScore: 5,
    submittedAt: NOW,
    editableUntil: new Date('2026-08-10T12:00:00.000Z'),
    clinicResponse: '',
    ...over,
  }) as RatingDocument;

const input = {
  procedureId: PROCEDURE,
  doctorScore: 4,
  clinicScore: 5,
  subscores: {},
  comment: 'Good care',
};

describe('rating service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    ratings.aggregateDoctorsForClinic.mockResolvedValue([]);
    ratings.aggregateForClinic.mockResolvedValue({
      ratingCount: 0,
      avgDoctorScore: 0,
      avgClinicScore: 0,
    });
    clinics.updateById.mockResolvedValue(true);
    ratings.updateById.mockResolvedValue(true);
  });

  describe('submitting', () => {
    beforeEach(() => {
      procedures.findById.mockResolvedValue(procedure());
      plans.findByProcedureId.mockResolvedValue(plan('completed'));
      ratings.findByProcedure.mockResolvedValue(null);
      ratings.create.mockResolvedValue(RATING);
      ratings.findById.mockResolvedValue(rating());
    });

    it('files the rating and answers 201', async () => {
      const { status, data } = await submitRatingService(PATIENT, CLINIC, input);

      expect(status).toBe(201);
      expect(data).toMatchObject({ doctorScore: 4, clinicScore: 5 });
    });

    /**
     * A patient mid-recovery is rating their pain, not their outcome. The plan's status is the
     * only thing that decides this, and it is read from the record rather than trusted from the
     * request — the portal is reachable by anyone holding a magic link.
     */
    it('refuses while the plan is still running', async () => {
      plans.findByProcedureId.mockResolvedValue(plan('active'));

      const { status, data } = await submitRatingService(PATIENT, CLINIC, input);

      expect(status).toBe(409);
      expect(data).toEqual({ error: 'PLAN_NOT_COMPLETE' });
      expect(ratings.create).not.toHaveBeenCalled();
    });

    it('refuses a second rating for the same procedure', async () => {
      ratings.findByProcedure.mockResolvedValue(rating());

      const { status, data } = await submitRatingService(PATIENT, CLINIC, input);

      expect(status).toBe(409);
      expect(data).toEqual({ error: 'ALREADY_RATED' });
    });

    /** Someone else's procedure is a 404, not a 403 — the id is not confirmed to exist. */
    it('refuses a procedure belonging to another patient', async () => {
      procedures.findById.mockResolvedValue(procedure(OTHER));

      expect((await submitRatingService(PATIENT, CLINIC, input)).status).toBe(404);
      expect(ratings.create).not.toHaveBeenCalled();
    });

    it('opens a 24-hour correction window from the moment of submission', async () => {
      await submitRatingService(PATIENT, CLINIC, input);

      const written = ratings.create.mock.calls[0][0];
      expect(written.editableUntil.getTime() - NOW.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('recomputes the clinic average rather than incrementing it', async () => {
      ratings.aggregateForClinic.mockResolvedValue({
        ratingCount: 3,
        avgDoctorScore: 4.333333,
        avgClinicScore: 5,
      });

      await submitRatingService(PATIENT, CLINIC, input);

      expect(clinics.updateById).toHaveBeenCalledWith(CLINIC, {
        ratingCount: 3,
        avgDoctorScore: 4.3,
        avgClinicScore: 5,
      });
    });
  });

  describe('the correction window', () => {
    it('accepts a revision while it is open', async () => {
      ratings.findById.mockResolvedValue(rating());

      const { status } = await reviseRatingService(RATING, PATIENT, {
        doctorScore: 2,
        clinicScore: 2,
      });

      expect(status).toBe(200);
      expect(ratings.updateById).toHaveBeenCalled();
    });

    it('closes once editableUntil has passed', async () => {
      ratings.findById.mockResolvedValue(
        rating({ editableUntil: new Date('2026-08-09T11:59:59.000Z') })
      );

      const { status, data } = await reviseRatingService(RATING, PATIENT, {
        doctorScore: 1,
        clinicScore: 1,
      });

      expect(status).toBe(409);
      expect(data).toEqual({ error: 'EDIT_WINDOW_CLOSED' });
      expect(ratings.updateById).not.toHaveBeenCalled();
    });

    /** Otherwise every revision buys another day, and the window never actually closes. */
    it('does not extend the window on revision', async () => {
      ratings.findById.mockResolvedValue(rating());

      await reviseRatingService(RATING, PATIENT, {
        doctorScore: 3,
        clinicScore: 3,
      });

      expect(ratings.updateById.mock.calls[0][1]).not.toHaveProperty('editableUntil');
    });

    it('refuses to let one patient revise another patient’s rating', async () => {
      ratings.findById.mockResolvedValue(rating());

      const { status } = await reviseRatingService(RATING, OTHER, {
        doctorScore: 1,
        clinicScore: 1,
      });

      expect(status).toBe(404);
      expect(ratings.updateById).not.toHaveBeenCalled();
    });
  });

  /**
   * The threshold is the point of the feature. One unhappy patient is not a 2.0 clinic, and a
   * clinic shown that number learns something untrue about itself.
   */
  describe('the clinic summary', () => {
    beforeEach(() => {
      ratings.findByClinic.mockResolvedValue([]);
    });

    /*
      Both boundary cases are derived from `MIN_RATINGS_FOR_AVERAGE` rather than written as 4 and
      5. The rule under test is "one short is withheld, exactly enough is shown", which is a fact
      about the threshold and not about the number five — pinning the literal made the suppression
      rule untestable at any other value and turned tuning the constant into a spec failure.
    */
    it('withholds the averages one rating short of the threshold', async () => {
      ratings.aggregateForClinic.mockResolvedValue({
        ratingCount: MIN_RATINGS_FOR_AVERAGE - 1,
        avgDoctorScore: 5,
        avgClinicScore: 5,
      });

      const { data } = await listClinicRatingsService(CLINIC);

      expect('summary' in data && data.summary).toMatchObject({
        belowThreshold: true,
        avgDoctorScore: null,
        avgClinicScore: null,
        ratingCount: MIN_RATINGS_FOR_AVERAGE - 1,
      });
    });

    it('shows them at exactly the threshold', async () => {
      ratings.aggregateForClinic.mockResolvedValue({
        ratingCount: MIN_RATINGS_FOR_AVERAGE,
        avgDoctorScore: 4.24,
        avgClinicScore: 3.96,
      });

      const { data } = await listClinicRatingsService(CLINIC);

      expect('summary' in data && data.summary).toMatchObject({
        belowThreshold: false,
        avgDoctorScore: 4.2,
        avgClinicScore: 4,
      });
    });
  });

  describe('the clinic response', () => {
    it('is recorded against the rating', async () => {
      ratings.findById.mockResolvedValue(rating());

      const { status } = await respondToRatingService(RATING, CLINIC, { response: 'Thank you' });

      expect(status).toBe(200);
      expect(ratings.updateById).toHaveBeenCalledWith(RATING, {
        clinicResponse: 'Thank you',
        respondedAt: NOW,
      });
    });

    it('cannot touch a rating belonging to another clinic', async () => {
      ratings.findById.mockResolvedValue(rating());

      expect((await respondToRatingService(RATING, OTHER, { response: 'x' })).status).toBe(404);
      expect(ratings.updateById).not.toHaveBeenCalled();
    });

    /** No route deletes or rewrites a patient's words, and no service function offers one. */
    it('never rewrites the patient’s scores or comment', async () => {
      ratings.findById.mockResolvedValue(rating());

      await respondToRatingService(RATING, CLINIC, { response: 'Thank you' });

      const written = ratings.updateById.mock.calls[0][1];
      expect(written).not.toHaveProperty('doctorScore');
      expect(written).not.toHaveProperty('clinicScore');
      expect(written).not.toHaveProperty('comment');
    });
  });

  describe('what the portal offers', () => {
    it('lists a completed plan that has not been rated', async () => {
      plans.findCompletedByPatient.mockResolvedValue([plan('completed')]);
      ratings.findByProcedure.mockResolvedValue(null);
      procedures.findById.mockResolvedValue(procedure());

      const { data } = await listRatablePlansService(PATIENT, CLINIC);

      expect('items' in data && data.items).toHaveLength(1);
    });

    it('drops one that already has a rating', async () => {
      plans.findCompletedByPatient.mockResolvedValue([plan('completed')]);
      ratings.findByProcedure.mockResolvedValue(rating());

      const { data } = await listRatablePlansService(PATIENT, CLINIC);

      expect('items' in data && data.items).toHaveLength(0);
    });
  });

  it('names the patient beside their rating for the clinic', async () => {
    ratings.aggregateForClinic.mockResolvedValue({
      ratingCount: 1,
      avgDoctorScore: 4,
      avgClinicScore: 5,
    });
    ratings.findByClinic.mockResolvedValue([rating()]);
    patients.findById.mockResolvedValue({ firstName: 'Nino', lastName: 'Beridze' } as never);

    const { data } = await listClinicRatingsService(CLINIC);

    expect('items' in data && data.items[0].patientName).toBe('Nino Beridze');
  });
});

/**
 * The rating form was reduced to its two star questions — four optional detail scores behind a
 * fold and a free-text box were costing completions without adding signal. The stored columns
 * stay, so a rating filed before that still reads back in full for the clinic.
 */
describe('a rating is two stars and nothing else', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    ratings.aggregateDoctorsForClinic.mockResolvedValue([]);
    ratings.aggregateForClinic.mockResolvedValue({
      ratingCount: 0,
      avgDoctorScore: 0,
      avgClinicScore: 0,
    });
    procedures.findById.mockResolvedValue(procedure());
    plans.findByProcedureId.mockResolvedValue(plan('completed'));
    ratings.findByProcedure.mockResolvedValue(null);
    ratings.create.mockResolvedValue(RATING);
    ratings.findById.mockResolvedValue(rating());
    ratings.updateById.mockResolvedValue(true);
  });

  it('writes a new rating blank on both withdrawn fields', async () => {
    await submitRatingService(PATIENT, CLINIC, {
      procedureId: PROCEDURE,
      doctorScore: 4,
      clinicScore: 5,
    });

    const written = ratings.create.mock.calls[0][0];
    expect(written.comment).toBe('');
    expect(written.subscores).toEqual({
      communication: null,
      cleanliness: null,
      painManagement: null,
      resultSatisfaction: null,
    });
  });

  it('still records the two star ratings', async () => {
    await submitRatingService(PATIENT, CLINIC, {
      procedureId: PROCEDURE,
      doctorScore: 4,
      clinicScore: 5,
    });

    expect(ratings.create.mock.calls[0][0]).toMatchObject({ doctorScore: 4, clinicScore: 5 });
  });

  /**
   * A patient correcting a mis-tapped star has said nothing about the comment they left before the
   * field was withdrawn. Blanking it would erase what they had already told the clinic.
   */
  it('leaves an older rating’s comment and subscores untouched on revision', async () => {
    ratings.findById.mockResolvedValue(rating({ comment: 'they were kind' }));

    await reviseRatingService(RATING, PATIENT, { doctorScore: 2, clinicScore: 3 });

    const patch = ratings.updateById.mock.calls[0][1];
    expect(patch).toEqual({ doctorScore: 2, clinicScore: 3 });
    expect(patch).not.toHaveProperty('comment');
    expect(patch).not.toHaveProperty('subscores');
  });
});

/**
 * A single house average tells a clinic whether its patients are happy, and not with whom. The
 * per-doctor breakdown is the question the page is actually asked.
 */
describe('the clinic sees each doctor’s own average', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    ratings.aggregateForClinic.mockResolvedValue({
      ratingCount: 0,
      avgDoctorScore: 0,
      avgClinicScore: 0,
    });
    ratings.findByClinic.mockResolvedValue([]);
    ratings.aggregateDoctorsForClinic.mockResolvedValue([]);
  });

  it('carries one entry per operating surgeon', async () => {
    ratings.aggregateDoctorsForClinic.mockResolvedValue([
      { _id: 'Dr Nino Beridze', ratingCount: 7, avgDoctorScore: 4.9 },
      { _id: 'Dr Giorgi Kapanadze', ratingCount: 3, avgDoctorScore: 4.2 },
    ] as never);

    const { data } = await listClinicRatingsService(CLINIC);

    expect('doctors' in data && data.doctors).toEqual([
      { name: 'Dr Nino Beridze', ratingCount: 7, avgDoctorScore: 4.9 },
      { name: 'Dr Giorgi Kapanadze', ratingCount: 3, avgDoctorScore: 4.2 },
    ]);
  });

  /** One decimal, matching every other average the product prints on a five-point scale. */
  it('rounds the average to one decimal', async () => {
    ratings.aggregateDoctorsForClinic.mockResolvedValue([
      { _id: 'Dr Nino Beridze', ratingCount: 3, avgDoctorScore: 4.666666666 },
    ] as never);

    const { data } = await listClinicRatingsService(CLINIC);

    expect('doctors' in data && data.doctors[0].avgDoctorScore).toBe(4.7);
  });

  /**
   * Unlike the public board, no minimum applies. The threshold exists so nobody is *ranked* on two
   * ratings, and a clinic reading its own doctors is not being ranked — it gets the count beside
   * the average and can weigh it itself.
   */
  it('shows an average that stands on a single rating', async () => {
    ratings.aggregateDoctorsForClinic.mockResolvedValue([
      { _id: 'Dr Nino Beridze', ratingCount: 1, avgDoctorScore: 5 },
    ] as never);

    const { data } = await listClinicRatingsService(CLINIC);

    expect('doctors' in data && data.doctors[0]).toMatchObject({ ratingCount: 1, avgDoctorScore: 5 });
  });

  it('is empty rather than absent when no rating names a surgeon', async () => {
    const { data } = await listClinicRatingsService(CLINIC);

    expect('doctors' in data && data.doctors).toEqual([]);
  });
});
