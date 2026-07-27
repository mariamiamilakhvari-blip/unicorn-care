/*
 * Unicorn Care service worker (PRD 04 §"Service worker").
 *
 * Plain JS, no bundler, no imports — this file is served verbatim from /sw.js.
 *
 * CACHING POLICY — deliberately almost nothing is cached.
 * A stale care plan is a clinical hazard: a patient shown a cached dose list could take a
 * medication that was changed or stopped hours ago. So this worker caches NO API responses,
 * NO JSON, and NO page HTML. Navigation requests are network-first with a plain "offline"
 * response as the only fallback — never stale dosing data. Everything else falls through to
 * the network untouched.
 */

const ICON_URL = '/icons/icon-192.png';
const PORTAL_URL = '/p';
const SUBSCRIBE_URL = '/api/patient-portal/push/subscribe';
const DEFAULT_TITLE = 'Unicorn Care';
const DEFAULT_TAG = 'unicorn-care';
const DEFAULT_DONE_LABEL = 'Done';

const OFFLINE_HTML =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Offline</title></head><body><h1>Offline</h1>' +
  '<p>Unicorn Care needs a connection. Your reminders are safe — reconnect to see them.</p>' +
  '</body></html>';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

/**
 * Read a push payload without ever throwing. A malformed or non-JSON body must not reject
 * inside the push handler — a thrown error there kills the whole notification.
 */
function readPayload(event) {
  if (!event.data) return {};
  try {
    const parsed = event.data.json();
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (error) {
    return {};
  }
}

function text(value, fallback) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

self.addEventListener('push', event => {
  const payload = readPayload(event);
  const occurrenceId = text(payload.occurrenceId, '');
  const url = text(payload.url, PORTAL_URL);

  const options = {
    body: text(payload.body, ''),
    icon: ICON_URL,
    badge: ICON_URL,
    // The occurrence id is the tag, so a resend of the same dose replaces the existing
    // notification instead of stacking a second one on the lock screen.
    tag: occurrenceId || text(payload.tag, DEFAULT_TAG),
    data: { url: url, occurrenceId: occurrenceId },
    actions: [{ action: 'done', title: text(payload.doneLabel, DEFAULT_DONE_LABEL) }],
  };

  event.waitUntil(self.registration.showNotification(text(payload.title, DEFAULT_TITLE), options));
});

/** Tick the dose off without opening the app. The portal cookie rides along on the request. */
function completeOccurrence(occurrenceId) {
  if (!occurrenceId) return Promise.resolve();
  return fetch('/api/patient-portal/occurrences/' + occurrenceId + '/complete', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => undefined);
}

function openPortal(url) {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(windowClients => {
      for (const client of windowClients) {
        if (client.url.indexOf(PORTAL_URL) !== -1 && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    });
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'done') {
    event.waitUntil(completeOccurrence(data.occurrenceId));
    return;
  }

  event.waitUntil(openPortal(text(data.url, PORTAL_URL)));
});

/**
 * The browser rotated the subscription. Re-subscribe with the same application server key and
 * re-POST, otherwise this device silently stops receiving reminders.
 */
async function resubscribe(event) {
  try {
    const previous = event.oldSubscription || (await self.registration.pushManager.getSubscription());
    const options = previous && previous.options ? previous.options : {};
    const fresh =
      event.newSubscription ||
      (await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: options.applicationServerKey,
      }));
    if (!fresh) return;

    await fetch(SUBSCRIBE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fresh.toJSON()),
    });
  } catch (error) {
    // Nothing recoverable here — the next in-app opt-in re-registers the endpoint.
  }
}

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(resubscribe(event));
});

async function navigateNetworkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // No cache fallback on purpose — see the caching policy note at the top of this file.
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', event => {
  // Navigation only. Assets, API calls and JSON are never intercepted and never cached.
  if (event.request.mode !== 'navigate') return;
  event.respondWith(navigateNetworkFirst(event.request));
});
