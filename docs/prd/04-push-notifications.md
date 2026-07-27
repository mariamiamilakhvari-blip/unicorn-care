# PRD 04 — Web Push Notifications (self-hosted VAPID)

**Push is the only delivery channel. No email. No SMS.**

## Dependency

`web-push` (npm). Server-side only — must never be imported from a client component or from
`src/proxy.ts` (Edge runtime).

## Env additions (`.env.example`)

```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ops@unicorn.care
CRON_SECRET=
```

Generate the pair once with `npx web-push generate-vapid-keys`. The public key is also exposed to
the browser as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (it is public by design — it is the server's
identity, not a secret). The private key never leaves the server.

## Client flow

1. Patient opens `/p` (portal home) on their phone.
2. A `PushOptIn` component shows install + enable state:
   - **iOS/iPadOS**: Web Push only works from a home-screen-installed PWA. If
     `navigator.standalone !== true` and the UA is iOS, show "Add to Home Screen" instructions
     first and hide the enable button. This is a hard platform constraint (Safari 16.4+), not
     something we can code around.
   - **Android/desktop Chromium**: the enable button is available immediately.
3. On tap → `Notification.requestPermission()` → on `granted`,
   `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
4. `POST /api/patient-portal/push/subscribe` with `{ endpoint, keys: { p256dh, auth } }`.
   Guarded by `patientGuard`; `endpoint` is unique, so re-subscribing upserts.
5. Store `userAgent` and the patient's `locale` on the subscription row.

Permission must be requested from a real user gesture. Never auto-prompt on page load — browsers
penalise it and patients dismiss it permanently.

## Service worker

`public/sw.js` — plain JS, no bundler, registered from a client component
`src/features/notifications/components/service-worker-register.tsx`.

Handles:
- `push` → `event.waitUntil(self.registration.showNotification(title, { body, icon, badge, tag, data: { url, occurrenceId }, actions: [{action:'done',...}] }))`
- `notificationclick` → focus an existing portal window or `clients.openWindow(data.url)`;
  the `done` action posts to the complete endpoint so a dose can be checked off without opening
  the app
- `pushsubscriptionchange` → re-subscribe and re-POST to the subscribe endpoint

`tag` is set to the occurrence id so a repeated send replaces rather than stacks.

## Server dispatch

`src/features/notifications/`

```
schema/push-subscription.schema.ts
repository/push-subscription.repository.ts   + .spec.ts
service/push.service.ts                      + .spec.ts   // build payload, mark results
service/dispatch.service.ts                  + .spec.ts   // the sweep
components/push-opt-in.tsx
components/service-worker-register.tsx
hooks/use-push-subscription.ts
```

`src/shared/lib/web-push-client.ts` — class + singleton wrapping `web-push`
(`setVapidDetails` once, `sendNotification`), with a co-located `.spec.ts` per CLAUDE.md §13.

### The sweep — `GET /api/cron/dispatch-reminders`

Runs every 5 minutes.

1. Authorise: header `Authorization: Bearer ${CRON_SECRET}` must match, else 401.
   (Vercel Cron sends this automatically when `CRON_SECRET` is set.)
2. Query `ReminderOccurrence` where `status: 'pending'` and `dueAt <= now` and
   `dueAt >= now - 6h`, limit 500, sorted by `dueAt`.
3. For each, load active subscriptions for that patient and send.
4. On success → `status: 'sent'`, `sentAt: now`; reset `failureCount` to 0.
5. On `410` / `404` → mark that subscription `isActive: false`, keep the occurrence pending only
   if another subscription succeeded; if none, mark `sent` anyway to avoid an infinite retry loop
   and surface it in the clinic adherence view as undelivered.
6. Anything still `pending` with `dueAt < now - 6h` → `status: 'missed'`.
7. Rolling extension: for active plans whose generated horizon ends within 14 days, generate the
   next 90-day window (see PRD 03).

Cron registration in `vercel.ts`:

```ts
crons: [{ path: '/api/cron/dispatch-reminders', schedule: '*/5 * * * *' }]
```

For local dev, the same route can be hit manually with the bearer token.

## Payload shape

Built at generation time, stored on the occurrence, so dispatch is a pure read:

```
medication  title: "Amoxicillin — 500 mg"       body: "Take with food. 08:00"
rehab       title: "Lymphatic massage"           body: "Light · 10 min"
checkup     title: "Follow-up with Dr Beridze"   body: "Tomorrow 14:00 · Clinic, 2nd floor"
```

Notification body must never contain a diagnosis or procedure name — a lock-screen preview is
visible to anyone holding the phone. Keep clinical detail behind the portal, which requires the
cookie.

## Testing

- `occurrence-generator` and `clock` are pure → unit tests, including a DST-boundary case.
- `dispatch.service` tests mock `web-push-client` and the repositories, asserting the `410`
  deactivation path and the `missed` transition.
- The service worker itself is not unit-tested; verify manually on a real Android device and an
  installed iOS PWA before calling the feature done.
