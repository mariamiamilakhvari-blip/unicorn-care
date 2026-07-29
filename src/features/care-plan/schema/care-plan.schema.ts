import mongoose, { Schema, InferSchemaType } from 'mongoose';

const MedicationSchema = new Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  route: {
    type: String,
    enum: ['oral', 'topical', 'injection', 'other'],
    default: 'oral',
    required: true,
  },
  // Clinic-local wall-clock HH:mm, e.g. ["08:00","20:00"]. Resolved to UTC via clock.zonedTimeToUtc.
  timesOfDay: { type: [String], required: true },
  startsOn: { type: Date, required: true },
  endsOn: { type: Date, required: true },
  withFood: { type: Boolean, default: false, required: true },
  instructions: { type: String, required: false, default: '' },
  // Fires the dose reminder this many minutes early, the same way a checkup's lead time works.
  // 0 = at the dose time, which is what every plan written before this field existed keeps doing.
  remindMinutesBefore: { type: Number, default: 0, required: true },
});

const RehabTaskSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: false, default: '' },
  intensity: { type: String, enum: ['light', 'moderate', 'intense'], required: true },
  durationMinutes: { type: Number, required: false, default: 0 },
  timesOfDay: { type: [String], required: true },
  // 0 = Sunday, matching clock.weekdayInZone.
  daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
  startsOn: { type: Date, required: true },
  endsOn: { type: Date, required: true },
  remindMinutesBefore: { type: Number, default: 0, required: true },
});

const CheckupSchema = new Schema({
  scheduledAt: { type: Date, required: true },
  title: { type: String, required: true },
  location: { type: String, required: false, default: '' },
  remindHoursBefore: { type: Number, default: 24, required: true },
  completedAt: { type: Date, required: false, default: null },
});

const CarePlanSchema = new Schema(
  {
    procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    startsAt: { type: Date, required: true },
    rehabEndsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft',
      required: true,
    },
    medications: { type: [MedicationSchema], default: [] },
    rehabTasks: { type: [RehabTaskSchema], default: [] },
    checkups: { type: [CheckupSchema], default: [] },
    // Clinic-local `YYYY-MM-DD` of the last daily email sent for this plan. The once-per-day guard
    // for the digest sweep: a calendar-day key, not a timestamp, because "already emailed today"
    // is a question about the clinic's calendar rather than a rolling 24 hours.
    lastDigestOn: { type: String, required: false, default: '' },
  },
  { timestamps: true }
);

CarePlanSchema.index({ clinicId: 1, patientId: 1, status: 1 });
CarePlanSchema.index({ status: 1, rehabEndsAt: 1 });

/** Subdocuments get a Mongoose `_id` automatically — it is the link back from a ReminderOccurrence. */
export type MedicationItem = InferSchemaType<typeof MedicationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type RehabTaskItem = InferSchemaType<typeof RehabTaskSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type CheckupItem = InferSchemaType<typeof CheckupSchema> & {
  _id: mongoose.Types.ObjectId;
};

/** Shape accepted on create/update — subdocument `_id`s are assigned by Mongoose. */
export type CarePlanInput = InferSchemaType<typeof CarePlanSchema>;

export type CarePlanDocument = Omit<CarePlanInput, 'medications' | 'rehabTasks' | 'checkups'> & {
  _id: mongoose.Types.ObjectId;
  medications: MedicationItem[];
  rehabTasks: RehabTaskItem[];
  checkups: CheckupItem[];
};

export const CarePlanModel =
  mongoose.models.CarePlan || mongoose.model('CarePlan', CarePlanSchema);
