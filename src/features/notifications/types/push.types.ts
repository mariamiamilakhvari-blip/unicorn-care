/** Result of fanning a single payload out to one patient's active subscriptions. */
export type PushSendSummary = {
  /** Active subscriptions the patient had when the send started. */
  total: number;
  /** How many endpoints accepted the push. */
  sent: number;
  /** How many returned 404/410 and were deactivated. */
  deactivated: number;
};

/** Summary returned by the cron sweep (PRD 04 §"The sweep"). */
export type DispatchSummary = {
  /** Due occurrences selected by this run. */
  processed: number;
  /** Occurrences that reached at least one live subscription. */
  sent: number;
  /**
   * Occurrences marked `sent` with nothing to deliver to — no active subscription, or every
   * endpoint gone. Surfaced so the clinic adherence view can show them as undelivered.
   */
  undelivered: number;
  /** Occurrences aged past the grace window and flipped to `missed`. */
  missed: number;
  /** Active care plans whose occurrence horizon was rolled forward. */
  extendedPlans: number;
  /** Daily patient emails sent by this sweep. */
  emailed: number;
  /**
   * Timed reminder emails sent by this sweep — one per occurrence dispatched, distinct from the
   * once-a-day digest counted by `emailed`. Kept apart because they answer different questions:
   * a digest that stops arriving is a scheduling bug, a reminder that stops is a dispatch bug.
   */
  emailedReminders: number;
  /** Occurrences whose send threw. Retired as undelivered rather than left to block the run. */
  failed: number;
  /** Claimed rows the run ran out of time for, released back to `pending` for the next sweep. */
  abandoned: number;
};

/** Client-side opt-in state machine for `use-push-subscription`. */
export type PushStatus = 'unsupported' | 'idle' | 'pending' | 'enabled' | 'denied';
