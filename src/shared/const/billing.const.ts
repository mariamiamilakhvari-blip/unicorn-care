import { PlanKey } from '@/shared/const/plan.const';

export const BILLING_PERIODS = ['monthly', 'yearly'] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** Only these plans are purchasable — the trial is granted, never bought. */
export type PaidPlanKey = Exclude<PlanKey, 'trial'>;

/**
 * Dodo product ids live in the environment, not in code: `test_mode` and `live_mode` are separate
 * catalogues with different ids, so hardcoding them would silently charge against the wrong one.
 */
export function resolveProductId(plan: PaidPlanKey, period: BillingPeriod): string | null {
  const key = `DODO_PRODUCT_${plan.toUpperCase()}_${period.toUpperCase()}`;
  return process.env[key] ?? null;
}

export type ProductConflict = {
  productId: string;
  usedBy: string[];
};

/**
 * Finds product ids mapped to more than one plan or period.
 *
 * Two plans sharing an id means one of them charges the other's price. That is a silent revenue
 * or overcharge bug, so it is surfaced rather than left to be discovered on an invoice.
 */
export function findProductConflicts(): ProductConflict[] {
  const seen = new Map<string, string[]>();

  for (const plan of ['standard', 'premium'] as PaidPlanKey[]) {
    for (const period of BILLING_PERIODS) {
      const productId = resolveProductId(plan, period);
      if (!productId) continue;
      seen.set(productId, [...(seen.get(productId) ?? []), `${plan}/${period}`]);
    }
  }

  return [...seen.entries()]
    .filter(([, usedBy]) => usedBy.length > 1)
    .map(([productId, usedBy]) => ({ productId, usedBy }));
}
