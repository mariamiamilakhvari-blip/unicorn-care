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
  /**
   * Occurrences whose patient has no live channel at all — no active push subscription and no
   * usable email address.
   *
   * Distinct from `undelivered`, which also covers a send that was attempted and failed. This
   * counts reminders that never had anywhere to go, which is not a delivery problem but a
   * missing contact detail, and is fixed by the clinic rather than by retrying.
   */
  unreachable: number;
  /**
   * Occurrences retired without being sent because the patient withdrew consent to automated
   * messages.
   *
   * Deliberately not folded into `undelivered`. That number is a problem to investigate — a dead
   * endpoint, a bounced address — and this one is the platform working correctly: someone
   * exercised a right under the Law of Georgia on Personal Data Protection and the sweep obeyed.
   * Counting them together would have a clinic chasing a delivery fault that does not exist.
   */
  withheld: number;
  /**
   * Due occurrences left unclaimed because their clinic is past the 14-day grace window that
   * follows a lapse — an expired trial, a cancellation, a card that stopped working, none of
   * which were put right within a fortnight.
   *
   * A clinic that lapsed yesterday contributes nothing here: its reminders are still being sent.
   *
   * Counted apart from `withheld` because the rows end up somewhere else entirely: a withdrawn
   * consent retires the occurrence, whereas this one is left `pending` and untouched, so a clinic
   * that resubscribes inside the grace window has its reminders resume on the next sweep. A
   * number that climbs here is a billing problem with a clinical cost attached, and reads as one.
   */
  suspended: number;
  /** Occurrences aged past the grace window and flipped to `missed`. */
  missed: number;
  /** Plans whose rehabilitation window closed on this run and were retired to `completed`. */
  completedPlans: number;
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
