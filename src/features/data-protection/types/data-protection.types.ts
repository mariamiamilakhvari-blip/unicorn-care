import { ConsentSource, ConsentType } from '@/shared/const/consent-type.const';
import { DataRequestKind, DataRequestStatus } from '@/shared/const/data-request.const';

/** One consent as the portal and the export show it. Dates are ISO — this crosses `JSON.stringify`. */
export type ConsentView = {
  type: ConsentType;
  source: ConsentSource;
  grantedAt: string;
  revokedAt: string | null;
  consentTextVersion: string;
  /** Whether the patient may turn this one off for themselves — see `PATIENT_REVOCABLE_CONSENTS`. */
  isRevocable: boolean;
};

/** The portal's consent screen: what stands, what was withdrawn, and what can be. */
export type ConsentSettingsView = {
  consents: ConsentView[];
  /** The wording currently in force, so the screen can say what a fresh grant would agree to. */
  currentVersion: string;
};

/** What the portal gets back after toggling one consent. */
export type ConsentChangeResult = {
  type: ConsentType;
  granted: boolean;
};

export type DataRequestView = {
  id: string;
  kind: DataRequestKind;
  status: DataRequestStatus;
  detail: string;
  resolution: string;
  requestedAt: string;
  resolvedAt: string | null;
};

/**
 * Everything held about one patient, in the structured form the Law of Georgia on Personal Data
 * Protection entitles them to receive.
 *
 * Shaped as data rather than as a document: "structured, commonly used and machine-readable" is
 * the standard, and a PDF of the same facts satisfies the letter of it while being useless to
 * anyone trying to move their record to another clinic.
 *
 * `clinic` carries the controller's own details on purpose — an export that does not say who
 * processed the data leaves the patient unable to exercise any further right over it.
 */
export type PatientExport = {
  exportedAt: string;
  patient: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    age: number | null;
    sex: string;
    locale: string;
    timezone: string;
    allergies: string[];
  };
  clinic: {
    name: string;
    email: string;
    phone: string;
    addressLine: string;
  };
  consents: ConsentView[];
  dataRequests: DataRequestView[];
  carePlans: PatientExportPlan[];
  occurrences: PatientExportOccurrence[];
  recoveryLogs: PatientExportRecoveryLog[];
  symptomReports: PatientExportSymptomReport[];
};

export type PatientExportPlan = {
  status: string;
  startsAt: string;
  rehabEndsAt: string | null;
  medications: { name: string; dosage: string; timesOfDay: string[]; instructions: string }[];
  rehabTasks: { title: string; timesOfDay: string[] }[];
  checkups: { title: string; scheduledAt: string; location: string }[];
};

export type PatientExportOccurrence = {
  kind: string;
  title: string;
  /** The prescribed time, not the send time — the same distinction the portal draws. */
  scheduledAt: string;
  status: string;
  completedAt: string | null;
};

export type PatientExportRecoveryLog = {
  loggedAt: string;
  painLevel: number | null;
  swelling: string;
  mood: string;
  note: string;
};

export type PatientExportSymptomReport = {
  reportedAt: string;
  warningTitle: string;
  severity: string;
  note: string;
  status: string;
  clinicNote: string;
};
