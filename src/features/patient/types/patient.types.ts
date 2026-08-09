import { AppLocale } from '@/shared/types/roles';

export type PatientSex = 'female' | 'male' | 'other' | 'unspecified';

/** Wire shape of a patient. Dates are ISO strings so the payload survives JSON transport. */
export type PatientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string | null;
  sex: PatientSex;
  locale: AppLocale;
  allergies: string[];
  notes: string;
  isArchived: boolean;
};

/**
 * Whether reminders can reach this patient, and if not, why.
 *
 * `isReachable` is the whole question the clinic needs answered; the rest is what to do about it.
 * `EMAIL_SUPPRESSED` and `NO_CONTACT_METHOD` are kept apart because the remedies differ — one is
 * a bounce to resolve with the patient, the other is a detail nobody ever collected.
 */
export type PatientReachability = {
  hasEmail: boolean;
  emailSuppressed: boolean;
  hasPush: boolean;
  isReachable: boolean;
  reason: '' | 'NO_CONTACT_METHOD' | 'EMAIL_SUPPRESSED';
};

export type PatientListResult = {
  items: PatientSummary[];
  total: number;
  page: number;
  limit: number;
};

/** One-time magic link. `url` embeds the raw token and is never recoverable after this response. */
export type AccessLinkResult = {
  url: string;
  expiresAt: string;
};

export type AccessRevokeResult = {
  revokedTokens: number;
  deactivatedSubscriptions: number;
};

/** What a redeemed magic-link token resolves to — the portal's whole identity. */
export type PatientAccessGrant = {
  patientId: string;
  clinicId: string;
  locale: AppLocale;
};

export type PatientState = {
  patients: PatientSummary[];
  total: number;
  selectedPatientId: string | null;
  accessLink: AccessLinkResult | null;
  loading: boolean;
  error: string | null;
};

export type PatientActions = {
  setPatients: (patients: PatientSummary[], total: number) => void;
  setSelectedPatientId: (patientId: string | null) => void;
  setAccessLink: (accessLink: AccessLinkResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

export type PatientStore = PatientState & PatientActions;
export type PatientStoreType = PatientStore;
