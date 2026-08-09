import { MoodLevel, SwellingLevel } from '@/shared/const/recovery-log.const';

/** One point on the curve, as the portal and the clinic both see it. */
export type RecoveryLogView = {
  id: string;
  dayIndex: number;
  loggedAt: string;
  painLevel: number;
  swelling: SwellingLevel;
  mood: MoodLevel | null;
  note: string;
  /** Ids for the proxy route — never URLs. The bytes live in the private store. */
  photoIds: string[];
};

/**
 * What the clinic charts.
 *
 * `checkupDays` are marked on the axis because the question a clinic asks of this chart is
 * usually "what did it look like around the time we saw them" — a curve with no appointments on
 * it answers half of that.
 */
export type RecoveryTrendView = {
  points: RecoveryLogView[];
  checkupDays: number[];
};
