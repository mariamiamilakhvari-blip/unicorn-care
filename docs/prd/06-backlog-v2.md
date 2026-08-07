# PRD 06 — v2 Backlog

These features are in the original product brief but were deferred by the chosen v1 scope
("core clinical loop first"). Specced here so v2 is a build, not a redesign.

| Feature | Status |
|---|---|
| Doctor and clinic rating | Not built |
| **Complication vs norm** | **Built** — `src/features/recovery-guide/`, see §2 |
| Patient-reported recovery timeline | Not built |

---

## 1. Doctor and clinic rating

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
- Still outstanding: seeding platform-default guides per `PROCEDURE_TYPES`, and notifying the
  clinic when a report arrives (today it appears in the dashboard queue only).

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
