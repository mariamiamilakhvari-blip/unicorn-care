export type HomeFeatureIcon = 'pill' | 'activity' | 'bell';

export type HomeFeature = {
  key: 'carePlan' | 'reminders' | 'adherence';
  icon: HomeFeatureIcon;
};

/** Structure only — all copy lives in `messages/*.json` under the `marketing` namespace. */
export const HOME_FEATURES: HomeFeature[] = [
  { key: 'carePlan', icon: 'pill' },
  { key: 'reminders', icon: 'bell' },
  { key: 'adherence', icon: 'activity' },
];

export type HomeBenefitIcon = 'phone-off' | 'shield-check' | 'timer';

export type HomeBenefit = {
  key: 'fewerCalls' | 'saferRecovery' | 'fastSetup';
  icon: HomeBenefitIcon;
};

/**
 * The three reasons a clinic signs up, sitting directly under the hero — what the product does for
 * them, ahead of the feature deck that explains how. Same structure-only rule as `HOME_FEATURES`.
 */
export const HOME_BENEFITS: HomeBenefit[] = [
  { key: 'fewerCalls', icon: 'phone-off' },
  { key: 'saferRecovery', icon: 'shield-check' },
  { key: 'fastSetup', icon: 'timer' },
];
