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
  locale: AppLocale;
  expected: ExpectedItemView[];
  warning: WarningItemView[];
  isPublished: boolean;
  /** True when the content came from the platform default rather than this clinic's own edit. */
  isDefault: boolean;
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
