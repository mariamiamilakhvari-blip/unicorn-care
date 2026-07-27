# PRD 01 — Data Model

All schemas follow `CLAUDE.md` §4: `InferSchemaType` extended with `_id`, `{ timestamps: true }`,
model guarded with `mongoose.models.X || mongoose.model(...)`.

Feature ownership of each schema file:

| Model | File |
|---|---|
| `User` (extended) | `src/features/auth/schema/user.schema.ts` |
| `Clinic` | `src/features/clinic/schema/clinic.schema.ts` |
| `Patient` | `src/features/patient/schema/patient.schema.ts` |
| `PatientAccessToken` | `src/features/patient/schema/patient-access-token.schema.ts` |
| `Procedure` | `src/features/procedure/schema/procedure.schema.ts` |
| `CarePlan` | `src/features/care-plan/schema/care-plan.schema.ts` |
| `ReminderOccurrence` | `src/features/care-plan/schema/reminder-occurrence.schema.ts` |
| `PushSubscription` | `src/features/notifications/schema/push-subscription.schema.ts` |

## 1. User — extend existing

Add two fields, extend the role enum. **Do not break existing `user` / `admin` values.**

```ts
role: { type: String, enum: ['user', 'admin', 'clinic_owner', 'clinic_staff'], default: 'user', required: true },
clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: false, default: null },
jobTitle: { type: String, required: false, default: '' },
```

`clinicId` is the tenancy key. Every clinical query filters on it.

## 2. Clinic

```ts
name:        { type: String, required: true },
slug:        { type: String, required: true, unique: true },
country:     { type: String, required: false, default: '' },
city:        { type: String, required: false, default: '' },
addressLine: { type: String, required: false, default: '' },
phone:       { type: String, required: false, default: '' },
logoUrl:     { type: String, required: false, default: '' },
locale:      { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
timezone:    { type: String, required: true, default: 'Asia/Tbilisi' },
ownerId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
isActive:    { type: Boolean, default: true, required: true },
```

`timezone` is what all reminder times are computed in. Store instants in UTC, render in this zone.

## 3. Patient

The patient is a **record owned by the clinic**, not a login.

```ts
clinicId:     { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
firstName:    { type: String, required: true },
lastName:     { type: String, required: true },
phone:        { type: String, required: false, default: '' },   // display only, never used to send
dateOfBirth:  { type: Date, required: false, default: null },
sex:          { type: String, enum: ['female', 'male', 'other', 'unspecified'], default: 'unspecified', required: true },
locale:       { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
allergies:    { type: [String], default: [] },
notes:        { type: String, required: false, default: '' },
isArchived:   { type: Boolean, default: false, required: true },
```

Index: `{ clinicId: 1, lastName: 1 }`.

## 4. PatientAccessToken

Grants portal access without a password. See `02-auth-and-magic-link.md` for the flow.

```ts
patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
clinicId:  { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
tokenHash: { type: String, required: true, unique: true },  // SHA-256 of the raw token
expiresAt: { type: Date, required: true },
revokedAt: { type: Date, required: false, default: null },
lastUsedAt:{ type: Date, required: false, default: null },
```

The raw token is shown to staff **once** at creation and never stored.

## 5. Procedure

One surgical/cosmetic event. A patient may have several over time.

```ts
patientId:       { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
clinicId:        { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
performedAt:     { type: Date, required: true },
operatorName:    { type: String, required: true },   // who performed it
operatorUserId:  { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },
manipulationType:{ type: String, required: true },   // key from PROCEDURE_TYPES const
manipulationDetail: { type: String, required: false, default: '' },
anesthesia:      { type: String, enum: ['none', 'local', 'sedation', 'general'], default: 'local', required: true },
notes:           { type: String, required: false, default: '' },
```

`PROCEDURE_TYPES` lives in `src/shared/const/procedure.const.ts` — an array of
`{ key, ka, en }` so the label is translatable and the stored value is stable.

## 6. CarePlan

One care plan per procedure. Holds the **rules**; dated instances live in `ReminderOccurrence`.

```ts
procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', required: true, unique: true },
patientId:   { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
clinicId:    { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
startsAt:    { type: Date, required: true },
rehabEndsAt: { type: Date, required: true },
status:      { type: String, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'draft', required: true },

medications: [{
  name:        { type: String, required: true },
  dosage:      { type: String, required: true },        // "500 mg", "1 tablet"
  route:       { type: String, enum: ['oral', 'topical', 'injection', 'other'], default: 'oral', required: true },
  timesOfDay:  { type: [String], required: true },       // ["08:00","20:00"] clinic-local HH:mm
  startsOn:    { type: Date, required: true },
  endsOn:      { type: Date, required: true },
  withFood:    { type: Boolean, default: false, required: true },
  instructions:{ type: String, required: false, default: '' },
}],

rehabTasks: [{
  title:       { type: String, required: true },
  description: { type: String, required: false, default: '' },
  intensity:   { type: String, enum: ['light', 'moderate', 'intense'], required: true },
  durationMinutes: { type: Number, required: false, default: 0 },
  timesOfDay:  { type: [String], required: true },
  daysOfWeek:  { type: [Number], default: [0,1,2,3,4,5,6] },   // 0=Sunday
  startsOn:    { type: Date, required: true },
  endsOn:      { type: Date, required: true },
}],

checkups: [{
  scheduledAt: { type: Date, required: true },
  title:       { type: String, required: true },
  location:    { type: String, required: false, default: '' },
  remindHoursBefore: { type: Number, default: 24, required: true },
  completedAt: { type: Date, required: false, default: null },
}],
```

Subdocuments get Mongoose `_id` automatically — that id is the link back from an occurrence.

## 7. ReminderOccurrence

The materialised, dated instance. This is what push reads and what the patient checks off.
Generating rows up front (rather than computing on the fly) makes the dispatch cron a single
indexed range query and makes adherence history real data.

```ts
carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', required: true, index: true },
patientId:  { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
clinicId:   { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
kind:       { type: String, enum: ['medication', 'rehab', 'checkup'], required: true },
sourceItemId: { type: Schema.Types.ObjectId, required: true },  // subdoc _id in CarePlan
title:      { type: String, required: true },
body:       { type: String, required: false, default: '' },
intensity:  { type: String, enum: ['light', 'moderate', 'intense'], required: false, default: null },
dueAt:      { type: Date, required: true },
status:     { type: String, enum: ['pending', 'sent', 'done', 'skipped', 'missed'], default: 'pending', required: true },
sentAt:     { type: Date, required: false, default: null },
completedAt:{ type: Date, required: false, default: null },
```

Indexes:
- `{ status: 1, dueAt: 1 }` — dispatch query
- `{ patientId: 1, dueAt: 1 }` — patient's day view

## 8. PushSubscription

```ts
patientId:   { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
endpoint:    { type: String, required: true, unique: true },
p256dh:      { type: String, required: true },
authKey:     { type: String, required: true },
userAgent:   { type: String, required: false, default: '' },
locale:      { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
isActive:    { type: Boolean, default: true, required: true },
failureCount:{ type: Number, default: 0, required: true },
lastSuccessAt: { type: Date, required: false, default: null },
```

On a `410 Gone` or `404` from the push service, set `isActive: false` — the browser dropped it.

## Relationship summary

```
Clinic 1─n User(staff)
Clinic 1─n Patient 1─n Procedure 1─1 CarePlan 1─n ReminderOccurrence
Patient 1─n PatientAccessToken
Patient 1─n PushSubscription
```
