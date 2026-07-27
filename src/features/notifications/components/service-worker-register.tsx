'use client';
import { useEffect } from 'react';

/**
 * Registers `/sw.js` (PRD 04 §"Service worker"). Renders nothing — mount it once inside the
 * patient portal layout. Registration is the only side effect: it never asks for notification
 * permission, which must come from a real user gesture in `PushOptIn`.
 */
export const ServiceWorkerRegister = () => {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  return null;
};
