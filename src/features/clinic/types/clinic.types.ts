import { CompanyStatus } from '@/shared/const/napr.const';
import { PlanKey } from '@/shared/const/plan.const';
import { SubscriptionStatus } from '@/shared/const/subscription.const';
import { AppLocale } from '@/shared/types/roles';

/** Wire shape of a clinic — what every clinic API route returns. No Mongoose types leak out. */
export type ClinicProfile = {
  id: string;
  name: string;
  /** Public-facing name where it differs from the registered one. Empty when there is no separate one. */
  brandName: string;
  /** The name English-language emails use. Empty when the clinic has supplied none, and the Georgian `name` then stands in. */
  nameEn: string;
  slug: string;
  country: string;
  city: string;
  addressLine: string;
  /** The address English-language emails use, under the same fallback as `nameEn`. */
  addressLineEn: string;
  phone: string;
  /** The clinic's contact address, not the owner's login. Empty string when none is set. */
  email: string;
  /** Tax ID / VAT / business registration number. Empty string when the clinic has not supplied one. */
  taxId: string;
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
 * What `GET /api/company/lookup` fills a registration form from.
 *
 * `address` and `city` are part of the shape but always empty: the Georgian Public Registry serves
 * an entity's address only on a CAPTCHA-gated detail page, which we do not automate. They are kept
 * rather than dropped so the client has one shape to bind to — and so that if a registry (or a
 * second provider for another country) ever does supply them, filling them in is a change to this
 * service alone. The form treats an empty string as "type it yourself", which is what it does
 * today for every lookup.
 */
export type CompanyLookup = {
  taxId: string;
  legalName: string;
  address: string;
  city: string;
  status: CompanyStatus;
};

/** The wire envelope. `success` is explicit so a miss and an outage are distinguishable. */
export type CompanyLookupResponse = {
  success: true;
  data: CompanyLookup;
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
  /** Whether there is a live subscription left to switch off — trialing or active, nothing else. */
  canCancel: boolean;
  /**
   * Cancelled, but still inside the period already paid for. `status` still reads `active` and
   * `renewsAt` is when access ends rather than when the next charge lands.
   */
  cancelScheduled: boolean;
  /**
   * Whether reminders are still going out. True on a live subscription, and true on a lapsed one
   * until the 14-day grace window closes — writing and sending stop at different moments.
   */
  remindersActive: boolean;
  /** Lapsed, but still inside the grace window: reminders are running on borrowed time. */
  isInGrace: boolean;
  /** Inside the last four days of the grace window. */
  isGraceWarning: boolean;
  /** When reminders stop. `null` while the subscription is live. */
  graceEndsAt: string | null;
  graceDaysLeft: number | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  renewsAt: string | null;
};

/** What an account deletion removed, so the UI can report it before signing the owner out. */
export type DeleteClinicResult = {
  deleted: true;
  subscriptionCancelled: boolean;
  counts: {
    patients: number;
    procedures: number;
    carePlans: number;
    reminders: number;
    recoveryGuides: number;
    staff: number;
  };
};
