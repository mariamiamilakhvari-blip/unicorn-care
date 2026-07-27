import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ReminderOccurrenceSchema = new Schema(
  {
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    kind: { type: String, enum: ['medication', 'rehab', 'checkup'], required: true },
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
    status: {
      type: String,
      enum: ['pending', 'sent', 'done', 'skipped', 'missed'],
      default: 'pending',
      required: true,
    },
    sentAt: { type: Date, required: false, default: null },
    completedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

// Dispatch cron range query.
ReminderOccurrenceSchema.index({ status: 1, dueAt: 1 });
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
