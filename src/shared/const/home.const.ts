export type HomeBenefitIcon = 'phone-off' | 'shield-check' | 'timer';

export type HomeBenefit = {
  key: 'fewerCalls' | 'saferRecovery' | 'fastSetup';
  icon: HomeBenefitIcon;
};

/**
 * The three reasons a clinic signs up, sitting directly under the hero — what the product does for
 * them. Structure only: all copy lives in `messages/*.json` under the `marketing` namespace.
 */
export const HOME_BENEFITS: HomeBenefit[] = [
  { key: 'fewerCalls', icon: 'phone-off' },
  { key: 'saferRecovery', icon: 'shield-check' },
  { key: 'fastSetup', icon: 'timer' },
];
