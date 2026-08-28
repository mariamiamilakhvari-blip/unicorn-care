import { WarningSeverity } from '@/shared/const/recovery.const';
import { SymptomReportStatus } from '@/shared/const/recovery.const';
import { AppLocale } from '@/shared/types/roles';

export type ExpectedItemView = {
  title: string;
  description: string;
  fromDay: number;
  toDay: number;
};

export type WarningItemView = {
  title: string;
  description: string;
  severity: WarningSeverity;
  /*
    The window this sign is worth watching for, in days since the operation. The schema has always
    stored it and the editor has always had inputs for it, but the view dropped it — so every load
    handed the form `undefined` and the next save wrote the day range back as 0–0. A guide with
    real windows silently flattened itself the first time anybody opened and saved it.
  */
  fromDay: number;
  toDay: number;
};

export type RecoveryGuideView = {
  id: string;
  manipulationType: string;
  /**
   * The language the content is actually written in — not the one that was asked for.
   *
   * They differ when the clinic has not published this guide in the patient's chosen language.
   * The portal compares the two and says so, because silently mixing languages leaves a patient
   * unsure whether they are reading their own clinic's instructions.
   */
  locale: AppLocale;
  expected: ExpectedItemView[];
  warning: WarningItemView[];
  isPublished: boolean;
  /** True when the content came from the platform default rather than this clinic's own edit. */
  isDefault: boolean;
};

/**
 * How a patient reaches their clinic from the portal.
 *
 * Carried with the guide because that is the panel that tells them to call: "contact your clinic"
 * beside no number is advice a patient cannot act on with a post-operative symptom in front of
 * them. Empty string when the clinic has not supplied one — the UI renders plain text rather than
 * a dead `tel:` link.
 */
export type ClinicContactView = {
  name: string;
  phone: string;
};

/** What `GET /api/patient-portal/recovery-guide` returns. */
export type PatientGuideView = RecoveryGuideView & {
  clinic: ClinicContactView;
};

/**
 * Who filed a report, carried with it so the clinic's queue can act on one.
 *
 * The queue used to print the symptom and the time and nothing else, which left a card reading
 * "temperature 39" with no way to tell whose temperature it was — the one fact the person reading
 * it needs before they can do anything. The name is resolved at read time from the patient record
 * rather than copied onto the report when it is filed, so a corrected name corrects the queue too.
 *
 * `name` is empty when the record has been erased under a data-subject request and `phone` is
 * empty whenever the clinic never held one. Both are ordinary states, not faults: the report is
 * retained as clinical record while the identity around it is not, and the UI says so rather than
 * rendering a blank or a dead `tel:` link.
 */
export type SymptomReportPatientView = {
  id: string;
  name: string;
  phone: string;
};

export type SymptomReportView = {
  id: string;
  patientId: string;
  /** Null when the patient record no longer exists — erased, or deleted outright. */
  patient: SymptomReportPatientView | null;
  procedureId: string | null;
  warningTitle: string;
  severity: string;
  note: string;
  status: SymptomReportStatus;
  clinicNote: string;
  createdAt: string;
};
