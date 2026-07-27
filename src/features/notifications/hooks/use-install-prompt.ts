'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/** Chromium's install event. Not in lib.dom, and iOS/iPadOS Safari never fires it at all. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** `navigator.standalone` is a non-standard Safari flag — the only iOS "am I installed?" signal. */
type StandaloneNavigator = Navigator & { standalone?: boolean };

const IOS_UA_PATTERN = /iPad|iPhone|iPod/;

/** iPadOS 13+ reports a desktop Safari UA, so the touch-point count is the only reliable tell. */
export const isIosDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return IOS_UA_PATTERN.test(navigator.userAgent) || iPadOs;
};

export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const nav: StandaloneNavigator = navigator;
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
};

/** Server render has no navigator — every environment probe starts false and hydrates client-side. */
const serverSnapshot = () => false;

const subscribeNever = () => () => undefined;

const subscribeInstalled = (onChange: () => void) => {
  window.addEventListener('appinstalled', onChange);
  return () => window.removeEventListener('appinstalled', onChange);
};

/**
 * Home-screen install state (PRD 04 §"Client flow" step 2).
 *
 * Chromium hands us a deferrable `beforeinstallprompt` we can replay from a button. iOS never
 * fires it, so there is nothing to replay — `showIosHint` drives the manual Share → Add to Home
 * Screen instructions instead. That is a Safari platform constraint, not something to code around.
 */
export const useInstallPrompt = () => {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  const isIos = useSyncExternalStore(subscribeNever, isIosDevice, serverSnapshot);
  const isInstalled = useSyncExternalStore(subscribeInstalled, isStandalone, serverSnapshot);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    const clear = () => setDeferredEvent(null);

    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', clear);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', clear);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    // A deferred prompt can only be replayed once.
    setDeferredEvent(null);
  }, [deferredEvent]);

  return {
    canPrompt: deferredEvent !== null,
    isIos,
    isInstalled,
    showIosHint: isIos && !isInstalled,
    promptInstall,
  };
};
