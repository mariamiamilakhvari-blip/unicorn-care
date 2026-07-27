# PRD 03 — Procedure, Care Plan, and Reminder Generation

## Flow

```
Staff: create Patient → log Procedure → build CarePlan (draft)
     → activate CarePlan → generator materialises ReminderOccurrence rows
Patient: opens portal → sees today's occurrences → marks done
Cron: sweeps due occurrences → sends push → marks sent
```

## 1. Procedure

`src/features/procedure/`

Create form fields (all map 1:1 to the schema in PRD 01):
- Date + time performed
- Operator — free-text name, plus optional link to a staff `User`
- Manipulation type — select backed by `PROCEDURE_TYPES` in `src/shared/const/procedure.const.ts`
- Manipulation detail — free text (e.g. "bilateral, 350cc")
- Anesthesia — none / local / sedation / general
- Notes

API: `POST /api/procedures`, `GET /api/procedures?patientId=`, `PATCH /api/procedures/:id`.
Every handler resolves `clinicId` via `clinicGuard` and passes it to the repository.

## 2. Care plan builder

`src/features/care-plan/`

One page, three sections, each a repeatable row editor built with `react-hook-form` +
`useFieldArray` and a Zod schema (CLAUDE.md §12 — never manual form state).

### Medications
`name · dosage · route · times of day (multi HH:mm) · starts on · ends on · with food · instructions`

### Rehab tasks
`title · description · intensity (light|moderate|intense) · duration minutes · times of day · days of week · starts on · ends on`

Intensity is a first-class field because it is what the clinic actually prescribes — "lymphatic
massage, light, 10 min, twice a day" is a different instruction from the same task at intense.
It renders as a coloured chip and rides along into the push notification body.

### Checkups
`scheduled at · title · location · remind hours before (default 24)`

Plus plan-level `startsAt` and `rehabEndsAt`.

### Validation rules (`care-plan.validation.ts`)

- `rehabEndsAt > startsAt`
- every item's `endsOn >= startsOn`
- every item window must fall inside `[startsAt, rehabEndsAt]`
- `timesOfDay` entries match `/^([01]\d|2[0-3]):[0-5]\d$/`, at least one, max 6, no duplicates
- `checkups[].scheduledAt > now` on create
- at least one medication, rehab task, or checkup before the plan can be activated

## 3. Occurrence generation

`src/features/care-plan/service/occurrence-generator.service.ts`

Pure function first, then persistence — so it is unit-testable without a DB:

```ts
export function buildOccurrences(plan: CarePlanDocument, timezone: string): OccurrenceDraft[]
```

Rules:
- **Medication** — for each day in `[startsOn, endsOn]`, for each `timesOfDay` entry, one
  occurrence at that clinic-local wall-clock time converted to UTC.
- **Rehab** — same, but only on days whose weekday is in `daysOfWeek`.
- **Checkup** — one occurrence at `scheduledAt - remindHoursBefore`.
- `title` / `body` are generated at build time and stored, in the **patient's** locale, so the
  dispatcher never needs to translate at send time.

Timezone handling: convert `HH:mm` in the clinic's IANA zone to a UTC instant using
`Intl.DateTimeFormat` offset resolution — no new date library. Put this in
`src/shared/lib/clock.ts` (class + singleton + `.spec.ts`), and test it across a DST boundary.

### Activation

`POST /api/care-plans/:id/activate`:
1. Validate the plan is complete
2. Delete existing `pending` occurrences for the plan (never touch `done` / `sent` history)
3. Insert freshly built occurrences
4. Set `status: 'active'`

Editing an active plan re-runs the same routine. A plan over a long horizon can generate a few
thousand rows; cap generation at **90 days** past `startsAt` and extend on a rolling basis from
the cron, so a one-year plan does not write a year of rows on day one.

## 4. Patient completion

`POST /api/patient-portal/occurrences/:id/complete` and `/skip`.

- `patientGuard` resolves the patient; the occurrence must belong to them or it is a 404 (not 403 —
  do not confirm existence).
- `complete` → `status: 'done'`, `completedAt: now`
- `skip` → `status: 'skipped'`
- A `pending` occurrence more than 6 hours past `dueAt` is treated as `missed` by the sweeper.

## 5. Adherence view (clinic side)

`GET /api/patients/:id/adherence` returns counts by status over the plan window, plus the
last 7 days bucketed by day. Rendered in the patient detail page as a compact segmented meter,
reusing the indigo segmented-meter pattern the locked design direction already specifies.

## Suggested file layout

```
src/features/procedure/
  schema/procedure.schema.ts
  repository/procedure.repository.ts        + .spec.ts
  service/procedure.service.ts              + .spec.ts
  validations/procedure.validation.ts
  types/procedure.types.ts
  components/procedure-form.tsx
  components/procedure-card.tsx
  hooks/use-create-procedure.ts

src/features/care-plan/
  schema/care-plan.schema.ts
  schema/reminder-occurrence.schema.ts
  repository/care-plan.repository.ts        + .spec.ts
  repository/reminder-occurrence.repository.ts + .spec.ts
  service/care-plan.service.ts              + .spec.ts
  service/occurrence-generator.service.ts   + .spec.ts
  validations/care-plan.validation.ts
  types/care-plan.types.ts
  components/care-plan-builder.tsx
  components/medication-fields.tsx
  components/rehab-task-fields.tsx
  components/checkup-fields.tsx
  components/occurrence-list.tsx
  components/intensity-chip.tsx
  hooks/use-care-plan.ts
  store/care-plan-store.ts
  hooks/useCarePlanStore.ts
```
