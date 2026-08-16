import { describe, expect, it } from 'vitest';

import {
  annualSavingPercent,
  convertMinor,
  displayCurrencyFor,
  findPlan,
  formatPrice,
  monthlyRateMinor,
  USD_TO_GEL,
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

  /*
    The Premium card states "unlimited patients" from `patientLimit: null` on the seat line and
    again in the plan blurb. A third copy in the feature list read as three separate promises, so
    the bullet was dropped — and this pins that, because re-adding it is a one-line change that
    looks like an improvement.
  */
  it('does not repeat the unlimited claim as a Premium feature bullet', () => {
    const keys = findPlan('premium').features.map(feature => feature.key);
    expect(keys).not.toContain('unlimitedPatients');
  });

  it('still sells Premium on what Standard does not have', () => {
    const keys = findPlan('premium').features.map(feature => feature.key);
    expect(keys).toContain('customGuidePerProcedure');
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

describe('display currency', () => {
  it('quotes Georgian in lari and everything else in dollars', () => {
    expect(displayCurrencyFor('ka')).toBe('GEL');
    expect(displayCurrencyFor('en')).toBe('USD');
  });

  it('leaves dollar amounts untouched', () => {
    expect(convertMinor(23_900, 'USD')).toBe(23_900);
    expect(formatPrice(23_900, 'USD')).toBe('$239');
  });

  it('converts the annual prices to lari at the quoted rate', () => {
    expect(formatPrice(findPlan('standard').annualPriceMinor, 'GEL')).toBe('₾645.30');
    expect(formatPrice(findPlan('premium').annualPriceMinor, 'GEL')).toBe('₾1320.30');
  });

  it('converts the monthly rates to lari', () => {
    expect(formatPrice(monthlyRateMinor(findPlan('standard'), 'monthly'), 'GEL')).toBe('₾78.30');
    expect(formatPrice(monthlyRateMinor(findPlan('premium'), 'monthly'), 'GEL')).toBe('₾159.30');
  });

  /*
    The badge is a ratio of two prices, so converting both by the same rate must leave it alone.
    A "Save 31%" that reads differently in Georgian would be two different advertised discounts.
  */
  it('advertises the same discount in either currency', () => {
    for (const key of ['standard', 'premium'] as const) {
      const plan = findPlan(key);
      const gelYearAtMonthly = convertMinor(yearlyAtMonthlyRateMinor(plan), 'GEL');
      const gelAnnual = convertMinor(plan.annualPriceMinor, 'GEL');
      const gelPercent = Math.round(((gelYearAtMonthly - gelAnnual) / gelYearAtMonthly) * 100);
      expect(gelPercent).toBe(annualSavingPercent(plan));
    }
  });

  it('never quotes lari at a rate that flatters the dollar price', () => {
    // A rate below 1 would make the plan look cheaper in lari than it is in dollars.
    expect(USD_TO_GEL).toBeGreaterThan(1);
  });
});
