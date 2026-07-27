'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { isIosDevice, isStandalone } from '@/features/notifications/hooks/use-install-prompt';
import { PushStatus } from '@/features/notifications/types/push.types';
import { http } from '@/shared/lib/http';

const SUBSCRIBE_PATH = '/patient-portal/push/subscribe';

/**
 * VAPID public keys travel as base64url; `pushManager.subscribe` wants raw bytes.
 * The key is public by design — it is the server's identity, not a secret (PRD 04 §Env).
 */
const toApplicationServerKey = (base64Url: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
};

const isPushSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** iOS/iPadOS only exposes Web Push to a home-screen-installed PWA (Safari 16.4+). */
const needsHomeScreenInstall = (): boolean => isIosDevice() && !isStandalone();

const serverSnapshot = () => false;

const subscribeNever = () => () => undefined;

const resolveStatus = (subscription: PushSubscription | null): PushStatus => {
  if (Notification.permission === 'denied') return 'denied';
  return subscription ? 'enabled' : 'idle';
};

/**
 * Opt-in state machine for Web Push (PRD 04 §"Client flow").
 *
 * `enable()` must be called from a real user gesture. Nothing here prompts on mount — a
 * drive-by permission prompt gets dismissed permanently and the patient can never be asked again.
 */
export const usePushSubscription = () => {
  const [permissionStatus, setPermissionStatus] = useState<PushStatus>('idle');

  const isSupported = useSyncExternalStore(subscribeNever, isPushSupported, serverSnapshot);
  const isIosNeedsInstall = useSyncExternalStore(
    subscribeNever,
    needsHomeScreenInstall,
    serverSnapshot
  );

  useEffect(() => {
    if (!isPushSupported()) return;

    // Read-only probe: reflects an existing subscription without ever prompting.
    navigator.serviceWorker.ready
      .then(registration => registration.pushManager.getSubscription())
      .then(subscription => setPermissionStatus(resolveStatus(subscription)))
      .catch(() => setPermissionStatus('idle'));
  }, []);

  const enable = useCallback(async () => {
    if (!isPushSupported()) return;
    setPermissionStatus('pending');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPermissionStatus(permission === 'denied' ? 'denied' : 'idle');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toApplicationServerKey(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
        ),
      });

      await http.post(SUBSCRIBE_PATH, subscription.toJSON());
      setPermissionStatus('enabled');
    } catch {
      setPermissionStatus('idle');
    }
  }, []);

  const status: PushStatus = isSupported ? permissionStatus : 'unsupported';

  return { status, isSupported, isIosNeedsInstall, enable };
};
