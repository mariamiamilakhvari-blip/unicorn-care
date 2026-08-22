import { ratingRepository } from '@/features/rating/repository/rating.repository';
import {
  PublicClinicRating,
  PublicDoctorRating,
  PublicRatingsView,
  PublicReview,
} from '@/features/rating/types/rating.types';
import { MIN_RATINGS_FOR_AVERAGE } from '@/shared/const/rating.const';
import { ServiceResult } from '@/shared/types/common';

/** How many entries each board carries. Long enough to be a ranking, short enough to be read. */
const BOARD_LIMIT = 10;

/** How many published reviews travel with the boards. */
const REVIEW_LIMIT = 12;

/** One decimal, which is the precision the scale can honestly support. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The public rating boards (PRD 06).
 *
 * Unauthenticated by design — this is what a prospective patient reads before choosing where to
 * have surgery — so what it may and may not contain is the whole design:
 *
 * - **Aggregates are published, individual ratings are not.** An average is a fact about a clinic
 *   or a surgeon. The rating rows behind it belong to patients and stay server-side; nothing here
 *   carries a patient id, a name, a procedure or a date of surgery.
 * - **A comment is published only when `isPublic` is set**, which defaults to `false` on the
 *   schema. Free text is the one field that can re-identify someone in a small clinic, so it
 *   travels because a patient chose to publish it and for no other reason.
 * - **Nothing appears below `MIN_RATINGS_FOR_AVERAGE`.** The threshold already governs what a
 *   clinic sees about itself, and its own comment anticipated this: showing 5.0 after one happy
 *   patient "tells a patient something untrue about where they are about to have surgery". A
 *   ranking is exactly where that matters most, because the board sorts on the number.
 *
 * Takes no clinic scope, unlike every other read in this feature — there is no session here and
 * no tenant to scope to. That is safe precisely because the payload is aggregate: the tenancy
 * boundary is enforced by what the type can carry, not by a filter that could be forgotten.
 */
export async function getPublicRatingsService(): Promise<ServiceResult<PublicRatingsView>> {
  const [clinicRows, doctorRows, reviewRows] = await Promise.all([
    ratingRepository.aggregatePublicClinics(MIN_RATINGS_FOR_AVERAGE, BOARD_LIMIT),
    ratingRepository.aggregatePublicDoctors(MIN_RATINGS_FOR_AVERAGE, BOARD_LIMIT),
    ratingRepository.findPublicReviews(REVIEW_LIMIT),
  ]);

  const clinics: PublicClinicRating[] = clinicRows.map(row => ({
    id: row._id.toString(),
    name: row.name,
    ratingCount: row.ratingCount,
    avgClinicScore: round(row.avgClinicScore),
    avgDoctorScore: round(row.avgDoctorScore),
  }));

  const doctors: PublicDoctorRating[] = doctorRows.map(row => ({
    name: row._id.operatorName,
    clinicName: row.clinicName,
    ratingCount: row.ratingCount,
    avgDoctorScore: round(row.avgDoctorScore),
  }));

  const reviews: PublicReview[] = reviewRows.map(row => ({
    id: row._id.toString(),
    comment: row.comment ?? '',
    doctorScore: row.doctorScore,
    clinicScore: row.clinicScore,
    submittedAt: row.submittedAt.toISOString(),
  }));

  return {
    data: { clinics, doctors, reviews, threshold: MIN_RATINGS_FOR_AVERAGE },
    status: 200,
  };
}
