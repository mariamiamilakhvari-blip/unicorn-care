/** A rating as the patient who wrote it sees it. */
export type RatingView = {
  id: string;
  procedureId: string;
  doctorScore: number;
  clinicScore: number;
  subscores: {
    communication: number | null;
    cleanliness: number | null;
    painManagement: number | null;
    resultSatisfaction: number | null;
  };
  comment: string;
  submittedAt: string;
  /** Whether the 24-hour correction window is still open. */
  isEditable: boolean;
  clinicResponse: string;
};

/** A completed plan the patient has not rated yet — what the portal card offers. */
export type RatablePlanView = {
  procedureId: string;
  manipulationType: string;
  operatorName: string;
  completedOn: string;
};

/**
 * A clinic's own view of its standing.
 *
 * `avgDoctorScore` and `avgClinicScore` are `null` below the threshold rather than zero: an
 * average of one rating is not an average, and showing 5.0 after a single happy patient — or 2.0
 * after a single unhappy one — tells a clinic something untrue about itself.
 */
export type ClinicRatingSummary = {
  ratingCount: number;
  avgDoctorScore: number | null;
  avgClinicScore: number | null;
  /** True until the clinic has enough ratings for an average to mean anything. */
  belowThreshold: boolean;
  threshold: number;
};

export type ClinicRatingListView = {
  summary: ClinicRatingSummary;
  items: (RatingView & { patientName: string })[];
};

/**
 * One clinic on the public board.
 *
 * Deliberately carries no patient-identifying anything. A clinic's average is a fact about the
 * clinic; the patients behind it stay out of the payload entirely, which is why this type exists
 * separately from `ClinicRatingListView` rather than being a narrowing of it — that one carries
 * `patientName`, and a shared type would be one careless spread away from publishing it.
 */
export type PublicClinicRating = {
  id: string;
  name: string;
  ratingCount: number;
  avgClinicScore: number;
  avgDoctorScore: number;
};

/** One doctor on the public board. Identified by name, which is how the roster is derived. */
export type PublicDoctorRating = {
  name: string;
  clinicName: string;
  ratingCount: number;
  avgDoctorScore: number;
};

/**
 * A published review.
 *
 * `isPublic` gates it and defaults to `false`, so this only ever carries text a patient chose to
 * make public. No name, no procedure, no date of surgery — a free-text comment plus any of those
 * re-identifies someone in a small clinic.
 */
export type PublicReview = {
  id: string;
  comment: string;
  doctorScore: number;
  clinicScore: number;
  submittedAt: string;
};

export type PublicRatingsView = {
  clinics: PublicClinicRating[];
  doctors: PublicDoctorRating[];
  reviews: PublicReview[];
  /** The minimum rating count behind every figure above, so the page can say so. */
  threshold: number;
};
