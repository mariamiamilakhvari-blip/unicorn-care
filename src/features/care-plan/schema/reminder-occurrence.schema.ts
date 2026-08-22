import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ReminderOccurrenceSchema = new Schema(
  {
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    /*
      `guide` is an expected-sign notice generated from the clinic's recovery guide on the day of
      recovery that sign begins, not from anything in the care plan itself.

      `recovery_log` is the only kind that asks the patient for something rather than telling them
      something. It comes from the plan existing, not from any item inside it, which is why its
      `sourceItemId` is the plan's own id.
    */
    kind: {
      type: String,
      enum: ['medication', 'rehab', 'checkup', 'guide', 'recovery_log'],
      required: true,
    },
    // Subdocument _id inside the CarePlan that produced this row.
    sourceItemId: { type: Schema.Types.ObjectId, required: true },
    // title/body are rendered in the patient's locale at generation time so dispatch is a pure read.
    title: { type: String, required: true },
    body: { type: String, required: false, default: '' },
    intensity: {
      type: String,
      enum: ['light', 'moderate', 'intense'],
      required: false,
      default: null,
    },
    dueAt: { type: Date, required: true },
    /*
      When the patient is meant to act, as against `dueAt`, which is when the reminder is sent.
      They differ by the lead the clinic set: a dose at 08:00 with a 5-minute lead is `dueAt`
      07:55, `scheduledAt` 08:00. The email prints this one — printing `dueAt` told a patient to
      take their tablet at 07:55, every single time.

      Nullable because rows generated before this field existed have no way to recover it: the
      lead lives on the plan item, and the row does not carry it. Readers fall back to `dueAt`,
      which reproduces the old (wrong-by-the-lead) time rather than crashing on those rows.
    */
    scheduledAt: { type: Date, required: false, default: null },
    status: {
      type: String,
      // `sending` is the claimed state: a dispatch run has taken this row and no other run may
      // touch it. The Vercel cron hits the sweep every minute and a manual run may overlap it,
      // so without a claim both read the same `pending` rows and the patient is reminded twice.
      enum: ['pending', 'sending', 'sent', 'done', 'skipped', 'missed'],
      default: 'pending',
      required: true,
    },
    // Identifies which run owns a `sending` row, so a run only ever sends what it claimed itself.
    claimId: { type: String, required: false, default: null },
    claimedAt: { type: Date, required: false, default: null },
    sentAt: { type: Date, required: false, default: null },
    /*
      What each channel actually managed, recorded at dispatch.

      `status: 'sent'` says the sweep handled the row, not that anything reached the patient — it
      is set even when every push endpoint was gone and the email bounced, so the row is not
      retried forever. Reporting deliverability off it would show ~100% regardless of reality,
      which is why these two exist.

      `null` means the row was dispatched before this was recorded. It is not `false`: the
      difference between "we tried and nothing landed" and "we never looked" is the difference
      between a delivery problem and no data, and a report must not present the second as the
      first.
    */
    pushDelivered: { type: Boolean, required: false, default: null },
    emailDelivered: { type: Boolean, required: false, default: null },
    completedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

// Dispatch cron range query.
ReminderOccurrenceSchema.index({ status: 1, dueAt: 1 });
// Re-reading a run's own claim, and sweeping up claims abandoned by a crashed run.
ReminderOccurrenceSchema.index({ claimId: 1 });
ReminderOccurrenceSchema.index({ status: 1, claimedAt: 1 });
// Patient day view.
ReminderOccurrenceSchema.index({ patientId: 1, dueAt: 1 });

export type ReminderOccurrenceInput = InferSchemaType<typeof ReminderOccurrenceSchema>;

export type ReminderOccurrenceDocument = ReminderOccurrenceInput & {
  _id: mongoose.Types.ObjectId;
};

export type ReminderStatus = ReminderOccurrenceDocument['status'];

export const ReminderOccurrenceModel =
  mongoose.models.ReminderOccurrence ||
  mongoose.model('ReminderOccurrence', ReminderOccurrenceSchema);
