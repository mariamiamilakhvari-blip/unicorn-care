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

export type HomeStatKey = 'languages' | 'push' | 'setup';

export const HOME_STAT_KEYS: HomeStatKey[] = ['languages', 'push', 'setup'];
