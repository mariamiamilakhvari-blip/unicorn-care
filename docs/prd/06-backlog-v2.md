# PRD 06 — v2 Backlog

These features are in the original product brief but were deferred by the chosen v1 scope
("core clinical loop first"). Specced here so v2 is a build, not a redesign.

| Feature | Status |
|---|---|
| **Doctor and clinic rating** | **Built** — `src/features/rating/`, see §1 |
| **Complication vs norm** | **Built** — `src/features/recovery-guide/`, see §2 |
| Patient-reported recovery timeline | Not built |
| **Email deliverability** | **Built** — typo hints, signed Resend webhook, suppression; see §4 |

---

## 1. Doctor and clinic rating — BUILT

Shipped as `src/features/rating/`. Notes on what the implementation settled on:

- **No `rating_request` occurrence.** The spec routed the ask through the dispatcher as a new
  occurrence kind, which would have meant a push and an email. The card simply appears in the
  portal once a plan completes and waits for a patient who chooses to open it — the difference
  between asking and chasing. Nothing clinical depends on a rating, so nothing chases one.
- **`status: 'completed'` had to be built first.** It was in the care-plan status enum from the
  start and nothing ever set it, so every finished plan stayed `active` forever. The sweep now
  calls `carePlanRepository.completeFinishedPlans(now)` and reports `completedPlans`, and it runs
  *before* the extension step — extending a plan that has already ended is precisely the work the
  churn guards exist to refuse.
- **The 24-hour window is stored, not computed.** `editableUntil` is written at submission and
  never extended on revision; otherwise each edit buys another day and the window never closes.
- **Aggregates are recomputed, never incremented.** A running average drifts the first time a
  write is lost or replayed and nothing would notice. A clinic has tens of ratings.
- **The threshold suppresses display, not storage.** `Clinic.avgDoctorScore` always holds the real
  average; `MIN_RATINGS_FOR_AVERAGE` (5) decides whether the summary shows it. Storing a
  suppressed value would lose the real one the moment the fifth rating arrived.
- **The clinic has exactly one write against a rating**: `POST /api/ratings/[id]/response`. There
  is no route that edits or deletes a patient's words, and the tests assert the response path
  writes no score or comment field.
- **Ratings are purged with the clinic** in `delete-clinic.service.ts` — they name the patient who
  wrote them and the doctor they are about.
- Reserved and unused: `isPublic`. Nothing publishes a rating yet.

### Original spec

**Trigger.** When a care plan's `rehabEndsAt` passes and `status` becomes `completed`, the
dispatcher creates a final occurrence of a new kind `rating_request`. The patient portal then
shows the rating card. Ratings are **not** solicited mid-rehab — an unhappy day-3 patient is not
evaluating the outcome.

**Schema** — `src/features/rating/schema/rating.schema.ts`

```ts
patientId:   ObjectId ref Patient, required, index
clinicId:    ObjectId ref Clinic, required, index
procedureId: ObjectId ref Procedure, required, unique   // one rating per procedure
operatorUserId: ObjectId ref User, optional
doctorScore: Number, min 1, max 5, required
clinicScore: Number, min 1, max 5, required
subscores:   { communication, cleanliness, painManagement, resultSatisfaction } // each 1-5, optional
comment:     String, default ''
submittedAt: Date, required
isPublic:    Boolean, default false
```

**Rules.**
- One rating per procedure, immutable once submitted (edit window: 24h, then locked).
- Clinic sees aggregate scores and comments; it cannot delete a rating, only respond.
- Aggregates (`avgDoctorScore`, `avgClinicScore`, `ratingCount`) are denormalised onto `Clinic`
  and recomputed on write — the dashboard reads them without an aggregation pipeline.
- A clinic with fewer than 5 ratings shows "not enough ratings yet" rather than a misleading average.

**UI.** 1–5 star scale, the four subscores as optional segmented rows, one free-text field.
Uses the locked indigo accent for filled stars.

---

## 2. Complication vs norm — BUILT

Shipped as `src/features/recovery-guide/`. Notes on what the implementation settled on:

- **Enums live in `src/shared/const/recovery.const.ts`, not in the schema files.** Client components
  need the severity values; importing them from a `*.schema.ts` pulled Mongoose and the whole
  MongoDB driver into the browser bundle. The schemas import from the const module instead.
- **Resolution order**: the clinic's own published guide wins; otherwise the platform default
  (`clinicId: null`); otherwise 404 and the portal shows nothing. It never invents reassurance.
- **Editing a clinic's copy never mutates the platform default**, so one clinic cannot change what
  another clinic's patients read.
- **The patient panel is the last thing in the portal** — a worried patient reaches clinic-authored
  guidance and the "contact your clinic" path, which is the only route the portal offers for a
  medical question. (It used to sit above an AI care assistant; that assistant has been removed.)
- **The emergency banner is standing and non-dismissible.**
- Symptom reports are a **queue, not triage**: no scoring, no ranking, no auto-escalation. Stored
  `severity` is only the label of the warning item the patient tapped.
- **The clinic is now told when a report arrives** — `symptom-alert.service.ts` emails the
  practice's contact address. A notification and not monitoring: it carries the patient's name and
  the guide label they tapped, never the free text they wrote, and says in as many words that
  nothing escalates if it goes unread. Filing the report never depends on the email succeeding.
- **Platform defaults are now seeded** — `recovery-guide-seed.service.ts`, run from
  `POST /api/admin/recovery-guides/seed` behind `adminGuard`. Before this the second rung of the
  resolution order did not exist in production (0 platform defaults, 7 clinic-authored guides
  across 4 clinics), so any patient whose clinic had not written a guide for their procedure
  opened the portal to a blank panel.
  - **Two families, not eighteen guides.** `surgical` and `nonSurgical`. Recovery differs far more
    between surgery and an injectable than between two operations, and writing eighteen bespoke
    guides would mean eighteen sets of procedure-specific clinical claims nobody here is
    qualified to make. `other` maps to `surgical` — the unknown case gets the more cautious text.
  - **Seeded `isPublished: false`.** Generic drafts are not clinical advice until a clinician has
    read them. They exist so a reviewer has something to correct rather than an empty editor.
  - **Idempotent and unable to overwrite.** `upsertDefault` puts every field in `$setOnInsert`, so
    re-running fills gaps only. A slot a clinician has edited or published is never touched.
  - **ka/en stay parallel** — same item count, order, severities and day windows, enforced by
    `recovery-guide-seed.const.spec.ts`. A translation gap that gave one language fewer warnings
    would be a clinical difference, and an invisible one.
  - Outstanding: a clinician still has to review and publish. Nothing reaches a patient until then.

### Original spec

**Purpose.** Tell the patient what is expected and what warrants a call, per procedure type.
This is the highest-liability surface in the product — content is clinic-authored, never
generated, and every screen carries an explicit "this is not emergency advice, call your clinic
or emergency services" banner.

**Schema** — `src/features/recovery-guide/schema/recovery-guide.schema.ts`

```ts
clinicId:         ObjectId ref Clinic, required, index
manipulationType: String, required          // matches Procedure.manipulationType
locale:           'ka' | 'en', required
expected: [{ title, description, fromDay, toDay }]        // "swelling peaks days 2-4"
warning:  [{ title, description, severity: 'call_clinic' | 'urgent' | 'emergency' }]
updatedByUserId:  ObjectId ref User
```

Seed a platform-default guide per `PROCEDURE_TYPES` entry that clinics can clone and edit.
A clinic guide overrides the default for that clinic.

**Symptom flag flow.** Portal button "Something doesn't feel right" → patient picks from the
`warning` list or writes free text → creates a `SymptomReport` → clinic dashboard shows it in an
"needs review" queue. In v2 this is a queue, not a triage engine. No automated clinical judgement.

---

## 3. Patient-reported recovery timeline

**Purpose.** "How is recovery going, time by time" from the patient's side, so the clinic can see
trajectory rather than a single checkup snapshot.

**Schema** — `src/features/recovery-log/schema/recovery-log.schema.ts`

```ts
patientId:  ObjectId ref Patient, required, index
carePlanId: ObjectId ref CarePlan, required, index
loggedAt:   Date, required
dayIndex:   Number, required            // days since procedure
painLevel:  Number, min 0, max 10, required
swelling:   'none' | 'mild' | 'moderate' | 'severe', required
mood:       'poor' | 'ok' | 'good', optional
note:       String, default ''
photoIds:   [ObjectId]                  // Vercel Blob, private
```

**Prompting.** A daily `recovery_log` occurrence at a clinic-configured hour, decreasing in
frequency: daily for week 1, every 3 days for weeks 2–4, weekly after.

**Photos.** Post-op photos are sensitive medical images. Requirements before this ships:
private Vercel Blob storage, signed short-lived read URLs, no CDN caching, explicit per-upload
patient consent, and clinic-side access logging. Do not ship photo upload without all five.

**Clinic view.** Pain and swelling as a sparkline over `dayIndex`, with the checkup dates marked —
the shape of the curve is the clinically useful signal.

---

## 4. Email deliverability: validation, bounce tracking, suppression

**Why it moved up the list.** Reminder email went from one digest per patient per day to one per
dose (`src/features/notifications/service/reminder-email.service.ts`). A patient on four
medications receives five-plus messages a day instead of one, so every bad address in a clinic's
records is now retried five times as often.

Volume is the lesser half. Patient email addresses are typed by clinic staff and **never
verified** — nothing today checks that an address is deliverable, or notices when it stops being
deliverable. Hard bounces are what damages a sending domain's reputation, and a domain that ends
up filtered takes every *good* address down with it: the failure mode is not "one patient misses a
reminder", it is "no patient receives anything and nobody is told".

**Three pieces, in the order they are worth building.**

### 4.1 Validation at entry

Syntax and domain plausibility on the patient form, at the moment a clinic types the address —
where it is cheap to correct. `ClinicProfileSchema.email` already does this shape of check for the
clinic's own contact address and is the pattern to follow.

Worth adding beyond syntax: a typo hint for the common domains (`gmail.co`, `gmial.com`,
`yaho.com`). Suggest, never rewrite — silently correcting a clinic's data entry is how a reminder
ends up at a stranger's inbox with a patient's medication in the subject line.

### 4.2 Bounce tracking

Resend posts delivery events to a webhook — `email.bounced`, `email.complained`, `email.delivered`.
There is no receiver today, so a bounce is invisible to the platform and to the clinic.

- Verify the webhook signature. `src/app/api/webhooks/dodo/route.ts` is the existing pattern for a
  signed provider webhook and should be followed rather than reinvented.
- Record the event against the patient: kind, timestamp, provider message.
- **Surface it to the clinic.** A bounce the platform knows about and the clinic does not is worse
  than no tracking, because it looks like the reminders are working.

### 4.3 Suppression

Stop sending to an address that has hard-bounced, and stop counting those sends as delivered.

- Hard bounce → suppress immediately; the address does not exist.
- Soft bounce → retry, suppress after a threshold; a full mailbox recovers, a dead domain does not.
- Spam complaint → suppress immediately and never resume without a fresh explicit opt-in.
- Suppression must be **visible and reversible by the clinic**, since the fix (ask the patient for
  a correct address) lives with the clinic and not with us.

**Interaction with push.** A suppressed email address must not silently disable the whole
reminder. Push is a separate channel with its own delivery record, and `undelivered` in
`DispatchSummary` already exists for exactly this: a reminder that reached nobody should be
countable as such, per channel.

**Operational, no code required, do this first.** Watch bounce and complaint rate in the Resend
dashboard. Above ~2% bounce or ~0.1% complaint, deliverability degrades regardless of what the
application does, and the work above becomes urgent rather than scheduled.
