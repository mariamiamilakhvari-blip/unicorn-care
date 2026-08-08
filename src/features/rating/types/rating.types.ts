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
