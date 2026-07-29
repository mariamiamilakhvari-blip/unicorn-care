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
    monthlyPriceMinor: 9_900,
    annualPriceMinor: 94_800,
    annualSavingMinor: 24_000,
    currency: 'USD',
    patientLimit: STANDARD_PATIENT_LIMIT,
    trialDays: null,
    features: STANDARD_FEATURES,
  },
  {
    key: 'premium',
    monthlyPriceMinor: 19_900,
    annualPriceMinor: 190_800,
    annualSavingMinor: 48_000,
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

/** Minor units → "$99". Whole dollars only; every listed price is a round number. */
export function formatPrice(minor: number): string {
  return `$${Math.round(minor / 100)}`;
}

/**
 * The headline monthly figure for a billing period.
 *
 * Annual is quoted as its monthly equivalent — $948/year reads as $79/month — because that is the
 * number a clinic compares against the monthly plan. Quoting the same $99 for both made the toggle
 * look broken and hid the saving entirely.
 */
export function monthlyRateMinor(plan: Plan, period: 'monthly' | 'yearly'): number {
  return period === 'monthly' ? plan.monthlyPriceMinor : Math.round(plan.annualPriceMinor / 12);
}

/** What a year costs when paying month to month — the figure the annual saving is measured against. */
export function yearlyAtMonthlyRateMinor(plan: Plan): number {
  return plan.monthlyPriceMinor * 12;
}
