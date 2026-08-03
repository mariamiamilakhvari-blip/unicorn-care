/**
 * Subscription plans.
 *
 * Prices are stored in minor units (tetri/cents) so no arithmetic ever touches a float.
 * `patientLimit: null` means unlimited.
 *
 * `status: 'available'` marks a feature that ships today. `status: 'planned'` marks one that is
 * sold on the roadmap but not built — the pricing page renders those visibly as upcoming rather
 * than as included, so nobody pays for something that does not exist yet.
 */
export const PLAN_KEYS = ['trial', 'standard', 'premium'] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

export type FeatureStatus = 'available' | 'planned';

export type PlanFeature = {
  key: string;
  status: FeatureStatus;
};

export type Plan = {
  key: PlanKey;
  /** Monthly price in minor units when billed annually. 0 for the trial. */
  monthlyPriceMinor: number;
  annualPriceMinor: number;
  annualSavingMinor: number;
  currency: 'USD';
  patientLimit: number | null;
  trialDays: number | null;
  features: PlanFeature[];
};

export const TRIAL_DAYS = 7;
export const TRIAL_PATIENT_LIMIT = 5;
export const STANDARD_PATIENT_LIMIT = 50;

/** Feature keys resolve to `pricing.feature.<key>` in the message catalogue. */
const STANDARD_FEATURES: PlanFeature[] = [
  { key: 'procedureRecords', status: 'available' },
  { key: 'complicationsGuide', status: 'available' },
  { key: 'checkupReminders', status: 'available' },
  { key: 'careAssistant', status: 'available' },
];

export const PLANS: Plan[] = [
  {
    key: 'trial',
    monthlyPriceMinor: 0,
    annualPriceMinor: 0,
    annualSavingMinor: 0,
    currency: 'USD',
    patientLimit: TRIAL_PATIENT_LIMIT,
    trialDays: TRIAL_DAYS,
    features: [
      { key: 'procedureRecords', status: 'available' },
      { key: 'complicationsGuide', status: 'available' },
      { key: 'noCreditCard', status: 'available' },
    ],
  },
  {
    key: 'standard',
    monthlyPriceMinor: 2_900,
    annualPriceMinor: 23_900,
    annualSavingMinor: 10_900,
    currency: 'USD',
    patientLimit: STANDARD_PATIENT_LIMIT,
    trialDays: null,
    features: STANDARD_FEATURES,
  },
  {
    key: 'premium',
    monthlyPriceMinor: 5_900,
    annualPriceMinor: 48_900,
    annualSavingMinor: 21_900,
    currency: 'USD',
    patientLimit: null,
    trialDays: null,
    features: [
      ...STANDARD_FEATURES,
      { key: 'unlimitedPatients', status: 'available' },
      { key: 'customGuidePerProcedure', status: 'available' },
    ],
  },
];

export function findPlan(key: PlanKey): Plan {
  const plan = PLANS.find(candidate => candidate.key === key);
  // Every stored key comes from PLAN_KEYS, so this is a guard against a bad migration, not a
  // reachable branch in normal use.
  return plan ?? PLANS[0];
}

/**
 * Minor units → "$29" or "$19.92".
 *
 * Cents are shown only when there are any. Every listed price is a round number, but the annual
 * plans divided by twelve are not — $239/year is $19.92/month — and rounding that to "$20" quotes
 * a rate the clinic is never charged.
 */
export function formatPrice(minor: number): string {
  const major = minor / 100;
  return Number.isInteger(major) ? `$${major}` : `$${major.toFixed(2)}`;
}

/**
 * The headline monthly figure for a billing period.
 *
 * Annual is quoted as its monthly equivalent — $239/year reads as $19.92/month — because that is
 * the number a clinic compares against the monthly plan. Quoting the same $29 for both made the
 * toggle look broken and hid the saving entirely.
 */
export function monthlyRateMinor(plan: Plan, period: 'monthly' | 'yearly'): number {
  return period === 'monthly' ? plan.monthlyPriceMinor : Math.round(plan.annualPriceMinor / 12);
}

/** What a year costs when paying month to month — the figure the annual saving is measured against. */
export function yearlyAtMonthlyRateMinor(plan: Plan): number {
  return plan.monthlyPriceMinor * 12;
}

/**
 * The annual discount as a whole percentage, for the "Save 31%" badge.
 *
 * Derived rather than stored: a hardcoded badge silently goes stale the next time a price moves,
 * and a discount that overstates itself is the kind of claim a regulator reads as advertising.
 * Returns 0 for the trial, which has no monthly rate to discount against.
 */
export function annualSavingPercent(plan: Plan): number {
  const yearAtMonthlyRate = yearlyAtMonthlyRateMinor(plan);
  if (yearAtMonthlyRate === 0) return 0;
  return Math.round(((yearAtMonthlyRate - plan.annualPriceMinor) / yearAtMonthlyRate) * 100);
}
