# PRD 00 — Unicorn Care — Overview

## Problem

After a plastic surgery procedure, recovery instructions live on paper or in a chat message.
Patients forget which medicine to take at which hour, when to do a rehab exercise and at what
intensity, and when the follow-up checkup is. Clinics have no record of whether the plan was
followed, and no signal when a patient reports something outside the norm.

## Product

A clinic-operated post-op recovery platform.

- Clinic staff log in, create a patient record, log the procedure (date, operator, manipulation
  type), and attach a **care plan**: medications with dosing times, rehab tasks with intensity,
  checkup dates, and a rehab end date.
- The patient never creates an account. They open a **magic link** sent by the clinic, install the
  PWA, and grant push permission. Reminders arrive as native push notifications on the phone.
- **Reminders go out by Web Push and email.** Push needs an installed PWA, which iOS enforces
  strictly, so email is what reaches most patients. Neither channel ever carries a diagnosis or
  procedure name — an inbox and a lock screen are both readable by other people. No SMS.

## Users

| Actor | How they get in | What they can do |
|---|---|---|
| Clinic owner (`role: clinic_owner`) | Email + password / Google | Manage clinic profile, invite staff, everything staff can do |
| Clinic staff (`role: clinic_staff`) | Email + password / Google | Create patients, procedures, care plans, view adherence |
| Patient | Magic link `/p/<token>` — no password | View own plan, mark doses/tasks done, subscribe to push |
| Platform admin (`role: admin`) | Email + password | Existing starter role; no clinical access in v1 |

## v1 scope (this build)

1. Clinic account + staff auth, roles, clinic-scoped data isolation
2. Patient records (clinic-created), magic-link token issuance + revocation
3. Procedure record: date, operator name, manipulation type, notes
4. Care plan: medication schedule, rehab tasks with intensity, checkup appointments, rehab end date
5. Reminder generation from the care plan into concrete dated **reminder occurrences**
6. Web Push delivery (self-hosted VAPID) + PWA install
7. Patient portal: today's plan, mark done, upcoming checkups
8. i18n `ka` + `en` from day 1

## Explicitly deferred to v2 (see `06-backlog-v2.md`)

- Doctor + clinic rating scale after rehab ends
- Complication-vs-norm reference content and "flag a symptom" triage flow
- Patient self-reported recovery timeline with photos

> These three are in the original product brief. They are deferred because the chosen v1 scope
> was "core clinical loop first". PRDs for them exist so v2 is a build, not a redesign.

## Non-goals (v1)

- Billing, payments, insurance
- Video consults / chat
- Native iOS/Android apps (PWA only)
- Medical-record import (HL7/FHIR)

## Architectural constraints (non-negotiable)

Everything follows `CLAUDE.md`:
- Feature-based structure `src/features/<feature>/{schema,repository,service,store,hooks,components,validations,types}`
- Layering: API route → `validateBody` → service (`ServiceResult<T>`, never throws) → repository (only layer touching Mongoose, `await mongo.connect()` first, `.lean()` on reads)
- `type` never `interface`; no `unknown` casts; no inline styles; no arbitrary Tailwind `[...]` values
- `@/` imports only; kebab-case files; constants in `src/shared/const/*.const.ts`
- Design direction is **locked** (§19): indigo B2B, Space Grotesk + Inter + Geist Mono, balanced motion.
  Do not re-ask design questions.

## Success criteria for v1

- A staff user creates a patient + procedure + care plan in under 3 minutes.
- The patient opens the magic link on a phone, installs the PWA, and receives a real push
  notification at the scheduled dose time.
- Marking a dose done is reflected in the clinic's adherence view.
- `npm run lint && npm run typecheck && npm run test:run && npm run build` all pass.

## Document map

| Doc | Covers |
|---|---|
| `01-data-model.md` | All Mongoose schemas, relations, indexes |
| `02-auth-and-magic-link.md` | Roles, clinic scoping, patient token access |
| `03-care-plan.md` | Procedure, medication, rehab task, checkup, occurrence generation |
| `04-push-notifications.md` | VAPID, service worker, subscriptions, dispatch cron |
| `05-i18n-and-pwa.md` | next-intl routing, message files, manifest, install flow |
| `06-backlog-v2.md` | Ratings, complication guide, recovery timeline |
