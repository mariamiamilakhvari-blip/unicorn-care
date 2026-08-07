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

export type SymptomReportView = {
  id: string;
  patientId: string;
  procedureId: string | null;
  warningTitle: string;
  severity: string;
  note: string;
  status: SymptomReportStatus;
  clinicNote: string;
  createdAt: string;
};
