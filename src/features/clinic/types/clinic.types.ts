import { PlanKey } from '@/shared/const/plan.const';
import { SubscriptionStatus } from '@/shared/const/subscription.const';
import { AppLocale } from '@/shared/types/roles';

/** Wire shape of a clinic — what every clinic API route returns. No Mongoose types leak out. */
export type ClinicProfile = {
  id: string;
  name: string;
  slug: string;
  country: string;
  city: string;
  addressLine: string;
  phone: string;
  logoUrl: string;
  locale: AppLocale;
  timezone: string;
  isActive: boolean;
};

export type RegisterClinicResult = {
  userId: string;
  clinicId: string;
};

/**
 * `temporaryPassword` is plaintext and returned exactly once, at creation. It is never stored
 * and never re-derivable — only its SHA-256 lands in the DB.
 */
export type CreateStaffResult = {
  userId: string;
  email: string;
  temporaryPassword: string;
};

/** Subscription state as the dashboard reads it. */
export type SubscriptionView = {
  plan: PlanKey;
  status: SubscriptionStatus;
  /** `null` means unlimited. */
  patientLimit: number | null;
  activePatients: number;
  isAtPatientLimit: boolean;
  canWrite: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  renewsAt: string | null;
};
