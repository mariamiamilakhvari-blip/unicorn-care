import { describe, expect, it } from 'vitest';

import {
  annualSavingPercent,
  findPlan,
  formatPrice,
  monthlyRateMinor,
  yearlyAtMonthlyRateMinor,
} from '@/shared/const/plan.const';

/**
 * The published price list is a commercial claim, so it is pinned here rather than left to be
 * checked by eye on the pricing page. A silent drift between the plan constants and the Dodo
 * catalogue is a charge the clinic did not agree to.
 */
describe('plan pricing', () => {
  it('lists the standard plan at $29/mo and $239/yr', () => {
    const standard = findPlan('standard');
    expect(standard.monthlyPriceMinor).toBe(2_900);
    expect(standard.annualPriceMinor).toBe(23_900);
  });

  it('lists the premium plan at $59/mo and $489/yr', () => {
    const premium = findPlan('premium');
    expect(premium.monthlyPriceMinor).toBe(5_900);
    expect(premium.annualPriceMinor).toBe(48_900);
  });

  it('quotes the annual plans as their true monthly equivalent', () => {
    expect(formatPrice(monthlyRateMinor(findPlan('standard'), 'yearly'))).toBe('$19.92');
    expect(formatPrice(monthlyRateMinor(findPlan('premium'), 'yearly'))).toBe('$40.75');
  });

  it('quotes the monthly plans unchanged', () => {
    expect(formatPrice(monthlyRateMinor(findPlan('standard'), 'monthly'))).toBe('$29');
    expect(formatPrice(monthlyRateMinor(findPlan('premium'), 'monthly'))).toBe('$59');
  });

  it('advertises a 31% annual saving on both paid plans', () => {
    expect(annualSavingPercent(findPlan('standard'))).toBe(31);
    expect(annualSavingPercent(findPlan('premium'))).toBe(31);
  });

  it('never advertises a saving larger than the one actually given', () => {
    for (const key of ['standard', 'premium'] as const) {
      const plan = findPlan(key);
      const claimed = annualSavingPercent(plan) / 100;
      const actual =
        (yearlyAtMonthlyRateMinor(plan) - plan.annualPriceMinor) / yearlyAtMonthlyRateMinor(plan);
      // Rounding to a whole percent may only ever round the claim down, never up.
      expect(claimed).toBeLessThanOrEqual(actual + 0.005);
    }
  });

  it('keeps the stored saving consistent with the two prices it sits between', () => {
    for (const key of ['standard', 'premium'] as const) {
      const plan = findPlan(key);
      expect(plan.annualSavingMinor).toBe(yearlyAtMonthlyRateMinor(plan) - plan.annualPriceMinor);
    }
  });

  it('shows cents only when the price has them', () => {
    expect(formatPrice(23_900)).toBe('$239');
    expect(formatPrice(1_992)).toBe('$19.92');
    expect(formatPrice(0)).toBe('$0');
  });

  it('gives the trial no discount to advertise', () => {
    expect(annualSavingPercent(findPlan('trial'))).toBe(0);
  });
});
