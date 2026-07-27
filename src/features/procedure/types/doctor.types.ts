export type DoctorPatientView = {
  id: string;
  name: string;
};

/**
 * A surgeon as the clinic sees them, assembled from their procedures rather than a maintained
 * roster. `hasAccount` distinguishes someone who merely appears on procedures from someone who
 * can also sign in.
 */
export type DoctorView = {
  name: string;
  procedureCount: number;
  manipulationTypes: string[];
  lastPerformedAt: string;
  patients: DoctorPatientView[];
  hasAccount: boolean;
  jobTitle: string;
};
