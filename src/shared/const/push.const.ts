/**
 * Where a dismissed push notice is remembered.
 *
 * `localStorage`, not the patient record: this is a UI preference about one browser, and a
 * patient who dismissed the notice on their phone should still see it on a tablet where
 * notifications might actually work. Prefixed so it cannot collide with anything else on the
 * origin.
 */
export const PUSH_DENIED_DISMISSED_KEY = 'uc:push-denied-dismissed';

/**
 * The steps for re-enabling notifications, in the order they are performed.
 *
 * Keys rather than sentences: each resolves to `push.fixStep.<key>` in the message catalogue, so
 * the wording is translated and a step cannot exist in one language and not the other.
 */
export const PUSH_FIX_STEP_KEYS = ['openSettings', 'findNotifications', 'allow', 'reload'] as const;
