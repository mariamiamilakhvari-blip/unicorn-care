import { Types } from 'mongoose';

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { ratingRepository } from '@/features/rating/repository/rating.repository';
import { RatingDocument } from '@/features/rating/schema/rating.schema';
import {
  ClinicDoctorRating,
  ClinicRatingListView,
  ClinicRatingSummary,
  RatablePlanView,
  RatingView,
} from '@/features/rating/types/rating.types';
import {
  RespondToRatingType,
  ReviseRatingType,
  SubmitRatingType,
} from '@/features/rating/validations/rating.validation';
import { MIN_RATINGS_FOR_AVERAGE, RATING_EDIT_WINDOW_HOURS } from '@/shared/const/rating.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

const CLINIC_LIST_LIMIT = 100;

function toView(rating: RatingDocument, now: Date): RatingView {
  return {
    id: rating._id.toString(),
    procedureId: rating.procedureId.toString(),
    doctorScore: rating.doctorScore,
    clinicScore: rating.clinicScore,
    subscores: {
      communication: rating.subscores?.communication ?? null,
      cleanliness: rating.subscores?.cleanliness ?? null,
      painManagement: rating.subscores?.painManagement ?? null,
      resultSatisfaction: rating.subscores?.resultSatisfaction ?? null,
    },
    comment: rating.comment ?? '',
    submittedAt: rating.submittedAt.toISOString(),
    isEditable: rating.editableUntil.getTime() > now.getTime(),
    clinicResponse: rating.clinicResponse ?? '',
  };
}

/**
 * Recomputes a clinic's averages and writes them onto the clinic record.
 *
 * Denormalised so the dashboard reads three numbers rather than running an aggregation on every
 * page load, and recomputed from the ratings rather than adjusted incrementally — a running
 * average drifts the first time a write is lost or replayed, and nothing would ever notice.
 */
async function refreshClinicAggregate(clinicId: string): Promise<void> {
  const aggregate = await ratingRepository.aggregateForClinic(clinicId);

  await clinicRepository.updateById(clinicId, {
    ratingCount: aggregate.ratingCount,
    // Rounded to one decimal: the extra precision is noise on a five-point scale.
    avgDoctorScore: Math.round(aggregate.avgDoctorScore * 10) / 10,
    avgClinicScore: Math.round(aggregate.avgClinicScore * 10) / 10,
  });
}

/**
 * The procedures this patient may rate: rehabilitation finished, and no rating filed yet.
 *
 * Nothing is offered mid-recovery. A patient three days past surgery is rating their pain rather
 * than their outcome, and a number collected then says more about where they are in healing than
 * about the care they were given.
 */
export async function listRatablePlansService(
  patientId: string,
  clinicId: string
): Promise<ServiceResult<{ items: RatablePlanView[] }>> {
  const plans = await carePlanRepository.findCompletedByPatient(patientId);

  const items: RatablePlanView[] = [];
  for (const plan of plans) {
    const procedureId = plan.procedureId.toString();
    if (await ratingRepository.findByProcedure(procedureId)) continue;

    const procedure = await procedureRepository.findById(procedureId, clinicId);
    if (!procedure) continue;

    items.push({
      procedureId,
      manipulationType: procedure.manipulationType,
      operatorName: procedure.operatorName,
      completedOn: plan.rehabEndsAt.toISOString(),
    });
  }

  return { data: { items }, status: 200 };
}

/**
 * Files a patient's rating.
 *
 * The procedure has to belong to this patient and its plan has to have finished — both checked
 * against the record rather than trusted from the body, because the only thing the request
 * carries is an id and the patient portal is reachable by anyone holding a magic link.
 */
export async function submitRatingService(
  patientId: string,
  clinicId: string,
  input: SubmitRatingType
): Promise<ServiceResult<RatingView>> {
  const procedure = await procedureRepository.findById(input.procedureId, clinicId);
  if (!procedure) return { data: { error: 'NOT_FOUND' }, status: 404 };
  if (procedure.patientId.toString() !== patientId) {
    return { data: { error: 'NOT_FOUND' }, status: 404 };
  }

  const plan = await carePlanRepository.findByProcedureId(input.procedureId, clinicId);
  if (!plan || plan.status !== 'completed') {
    return { data: { error: 'PLAN_NOT_COMPLETE' }, status: 409 };
  }

  // One per procedure. The unique index is the real guarantee; this is the readable error.
  if (await ratingRepository.findByProcedure(input.procedureId)) {
    return { data: { error: 'ALREADY_RATED' }, status: 409 };
  }

  const now = clock.now();
  const id = await ratingRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: new Types.ObjectId(clinicId),
    procedureId: new Types.ObjectId(input.procedureId),
    operatorUserId: procedure.operatorUserId ?? null,
    doctorScore: input.doctorScore,
    clinicScore: input.clinicScore,
    /*
      The detail scores and the free-text comment are no longer asked for. The columns stay so a
      rating filed before that still reads back in full, and a new one is written blank rather
      than left absent — an absent subdocument and an empty one read differently downstream.
    */
    subscores: {
      communication: null,
      cleanliness: null,
      painManagement: null,
      resultSatisfaction: null,
    },
    comment: '',
    submittedAt: now,
    editableUntil: new Date(now.getTime() + RATING_EDIT_WINDOW_HOURS * 60 * 60 * 1000),
    clinicResponse: '',
    respondedAt: null,
    isPublic: false,
  });

  await refreshClinicAggregate(clinicId);

  const created = await ratingRepository.findById(id);
  if (!created) return { data: { error: 'RATING_CREATE_FAILED' }, status: 500 };

  return { data: toView(created, now), status: 201 };
}

/**
 * Replaces a rating inside its correction window.
 *
 * The window exists because a five-point scale is easy to mis-tap and a rating that locked
 * instantly would preserve the slip forever. It closes because a rating a patient can revise
 * indefinitely is a rating a clinic can ask them to revise.
 */
export async function reviseRatingService(
  ratingId: string,
  patientId: string,
  input: ReviseRatingType
): Promise<ServiceResult<RatingView>> {
  const rating = await ratingRepository.findById(ratingId);
  if (!rating || rating.patientId.toString() !== patientId) {
    return { data: { error: 'NOT_FOUND' }, status: 404 };
  }

  const now = clock.now();
  if (rating.editableUntil.getTime() <= now.getTime()) {
    return { data: { error: 'EDIT_WINDOW_CLOSED' }, status: 409 };
  }

  /*
    Only the two stars are written. `subscores` and `comment` are left untouched rather than
    cleared: a patient correcting a mis-tap on the doctor's score has said nothing about the
    comment they left before the field was withdrawn, and blanking it would erase what they told
    the clinic. `editableUntil` is deliberately not extended — the window runs from the first
    submission.
  */
  await ratingRepository.updateById(ratingId, {
    doctorScore: input.doctorScore,
    clinicScore: input.clinicScore,
  });

  await refreshClinicAggregate(rating.clinicId.toString());

  const updated = await ratingRepository.findById(ratingId);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toView(updated, now), status: 200 };
}

/** Below the threshold the averages are withheld — see `ClinicRatingSummary`. */
function toSummary(count: number, doctor: number, clinic: number): ClinicRatingSummary {
  const enough = count >= MIN_RATINGS_FOR_AVERAGE;
  return {
    ratingCount: count,
    avgDoctorScore: enough ? doctor : null,
    avgClinicScore: enough ? clinic : null,
    belowThreshold: !enough,
    threshold: MIN_RATINGS_FOR_AVERAGE,
  };
}

/**
 * What a clinic sees: its own standing, each doctor's, and every rating with the patient who
 * wrote it.
 *
 * The per-doctor breakdown is the question a clinic actually asks of this page — a single house
 * average tells it whether patients are happy, and not with whom.
 */
export async function listClinicRatingsService(
  clinicId: string
): Promise<ServiceResult<ClinicRatingListView>> {
  const now = clock.now();
  const [aggregate, doctorRows, ratings] = await Promise.all([
    ratingRepository.aggregateForClinic(clinicId),
    ratingRepository.aggregateDoctorsForClinic(clinicId),
    ratingRepository.findByClinic(clinicId, CLINIC_LIST_LIMIT),
  ]);

  const doctors: ClinicDoctorRating[] = doctorRows.map(row => ({
    name: row._id,
    ratingCount: row.ratingCount,
    // One decimal, matching every other average the product prints on a five-point scale.
    avgDoctorScore: Math.round(row.avgDoctorScore * 10) / 10,
  }));

  const items = [];
  for (const rating of ratings) {
    const patient = await patientRepository.findById(rating.patientId.toString(), clinicId);
    items.push({
      ...toView(rating, now),
      patientName: patient ? `${patient.firstName} ${patient.lastName}`.trim() : '',
    });
  }

  return {
    data: {
      summary: toSummary(
        aggregate.ratingCount,
        Math.round(aggregate.avgDoctorScore * 10) / 10,
        Math.round(aggregate.avgClinicScore * 10) / 10
      ),
      doctors,
      items,
    },
    status: 200,
  };
}

/**
 * The clinic's reply to a rating.
 *
 * A clinic may answer and may never delete or amend the rating itself. A review a clinic can
 * remove is not a review, and the ability to respond is what makes an honest one survivable.
 */
export async function respondToRatingService(
  ratingId: string,
  clinicId: string,
  input: RespondToRatingType
): Promise<ServiceResult<RatingView>> {
  const rating = await ratingRepository.findById(ratingId);
  if (!rating || rating.clinicId.toString() !== clinicId) {
    return { data: { error: 'NOT_FOUND' }, status: 404 };
  }

  const now = clock.now();
  await ratingRepository.updateById(ratingId, {
    clinicResponse: input.response,
    respondedAt: now,
  });

  const updated = await ratingRepository.findById(ratingId);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toView(updated, now), status: 200 };
}
