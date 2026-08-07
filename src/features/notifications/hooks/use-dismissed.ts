'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Fired on dismissal so a notice mounted in this tab updates without waiting for a reload. */
const CHANGE_EVENT = 'uc:dismissed-change';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // `storage` only fires in *other* tabs, which is exactly the case the custom event misses.
  window.addEventListener('storage', onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Whether the patient has dismissed a notice, remembered across visits.
 *
 * `localStorage` is an external store, not derived state, so it is read through
 * `useSyncExternalStore` rather than an effect: reading it during render would produce markup the
 * server cannot match, and reading it in an effect means a render pass that paints the notice
 * before hiding it — a message flashing up and vanishing is worse than one that was never there.
 *
 * The server snapshot is "dismissed", so the notice is absent from the server's HTML and appears
 * only once the client has confirmed it should. A patient who has not dismissed it sees it on the
 * first client render, which is immediate.
 */
export function useDismissed(key: string): { isDismissed: boolean; dismiss: () => void } {
  const isDismissed = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) === 'true',
    () => true
  );

  const dismiss = useCallback(() => {
    window.localStorage.setItem(key, 'true');
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key]);

  return { isDismissed, dismiss };
}
