# Unicorn Care

A post-op recovery platform for plastic surgery clinics.

Clinic staff log a patient's procedure and attach a **care plan** — medications with dosing times,
rehab tasks with intensity, checkup dates, and a rehab end date. The system materialises that plan
into dated reminders and pushes them to the patient's phone.

The patient never creates an account. They open a **magic link** from the clinic, install the PWA,
and grant push permission.

**No email. No SMS. Web Push only.**

## Stack

Next.js 16 (App Router) · TypeScript strict · MongoDB via Mongoose · NextAuth v5 · Tailwind CSS +
shadcn/ui · Zod + react-hook-form · Zustand · next-intl (`ka` + `en`) · Vitest · `web-push` (VAPID)

## Getting started

```bash
npm install
cp .env.example .env      # then fill in the values below
docker compose up mongo   # or point MONGO_URI at your own instance
npm run dev
```

### Environment

| Variable | What it is |
|---|---|
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | NextAuth |
| `MONGO_URI` | MongoDB connection string |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push server identity |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Same public key, exposed to the browser |
| `CRON_SECRET` | Bearer token the reminder-dispatch cron must present |

Generate a VAPID pair with `npx web-push generate-vapid-keys --json`. The `.env` in this repo ships
a **development** pair — regenerate before deploying.

## Commands

```bash
npm run dev        # dev server on :3000
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest watch
npm run test:run   # Vitest once
```

The Husky pre-commit hook runs `lint → build → test` and blocks on failure.

## How it fits together

```
Clinic staff → patient record → procedure → care plan (draft)
             → activate  ──► occurrence generator materialises dated reminders
Cron (*/5)   → dispatch sweep ──► Web Push ──► patient's phone
Patient      → magic link → PWA install → today's plan → mark done
```

- **Tenancy**: every clinical query is scoped by `clinicId`, taken from the session and never from
  a request body. There is no unscoped find for a patient, procedure, care plan, or occurrence.
- **Magic links**: only the SHA-256 of a token is stored, so a database read yields no working
  links. Tokens expire in 90 days and are independently revocable; revoking also deactivates that
  patient's push subscriptions.
- **Timezones**: `HH:mm` entries are clinic-local wall clock, converted per calendar day, so a plan
  stays correct across a DST shift. Storage is always UTC.
- **Notification bodies** never carry a diagnosis or procedure name — a lock-screen preview is
  readable by anyone holding the phone.

## Cron — read this before deploying

`GET /api/cron/dispatch-reminders` is what actually sends reminders. It requires
`Authorization: Bearer $CRON_SECRET`. Locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/dispatch-reminders
```

**It has to run every few minutes, not daily.** The sweep only picks up reminders due within the
last `GRACE_HOURS` (6). Anything older is marked `missed`. A once-a-day run therefore leaves ~18
hours of doses unsent *and* marks them missed — the product silently stops working.

Vercel's **Hobby plan caps cron at once per day**, so `vercel.json` schedules a daily run as a
safety net only. The real scheduler is `.github/workflows/dispatch-reminders.yml`, which hits the
same endpoint every 5 minutes. Add two repository secrets for it:

| Secret | Value |
|---|---|
| `APP_URL` | `https://your-deployment.vercel.app` (no trailing slash) |
| `CRON_SECRET` | same value as the `CRON_SECRET` env var on Vercel |

GitHub's scheduler is best-effort: it can lag under load and disables scheduled workflows after 60
days without repository activity. For production use either Vercel **Pro** (then set
`vercel.json` back to `*/5 * * * *` and delete the workflow) or a dedicated scheduler such as
cron-job.org or Upstash QStash.

## iOS note

Web Push on iOS/iPadOS only works from a **home-screen-installed** PWA (Safari 16.4+). The portal
detects this and shows Add-to-Home-Screen instructions instead of an enable button. This is a
platform constraint, not something the app can work around.

## Documentation

Product and technical specs live in [`docs/prd/`](docs/prd/):

| Doc | Covers |
|---|---|
| `00-overview.md` | Problem, users, v1 scope, success criteria |
| `01-data-model.md` | Every schema, relation, and index |
| `02-auth-and-magic-link.md` | Roles, clinic scoping, patient token access |
| `03-care-plan.md` | Procedure, care plan, occurrence generation, adherence |
| `04-push-notifications.md` | VAPID, service worker, subscriptions, dispatch sweep |
| `05-i18n-and-pwa.md` | next-intl routing, message files, manifest, install |
| `06-backlog-v2.md` | Ratings, complication-vs-norm guide, recovery timeline |

Architecture rules for contributors (and agents) are in [`CLAUDE.md`](CLAUDE.md).

## Billing

Three plans, defined in `src/shared/const/plan.const.ts`:

| Plan | Price | Active patients |
|---|---|---|
| Free trial | $0 for 7 days, no card | 5 |
| Standard | $99/month billed annually ($948/year) | 50 |
| Premium | $199/month billed annually ($1,908/year) | Unlimited |

Limits are enforced in `checkPatientSeat`, called from `createPatientService` — the service layer,
so every caller is covered. Over the limit or outside an active subscription returns **402** with
`PATIENT_LIMIT_REACHED` or `SUBSCRIPTION_INACTIVE`; the UI distinguishes the two because they need
different responses from the clinic. Archived patients do not occupy a seat.

Trial expiry is **derived on read** from `trialEndsAt`, not written by a scheduled job, so a trial
cannot outlive its date because a cron failed to run.

### No payment provider is wired up

`PATCH /api/subscription` changes the plan without taking money. It exists as the seam a provider's
webhook would call after a successful charge. Before charging real customers you need a provider
(Stripe or similar), its webhook pointed at that service, and a customer/subscription id stored on
the clinic.

### Features sold but not built

The pricing page marks these **coming soon** rather than ticking them, because they do not exist:

- Daily check-in + triage (Normal / Monitor / Urgent)
- Email reminders — note this contradicts the current design, which is Web Push only, no email
- Patient review + rating system

Do not remove the "coming soon" marking until the feature ships.
