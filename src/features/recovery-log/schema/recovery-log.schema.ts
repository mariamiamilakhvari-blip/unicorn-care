import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { MOOD_LEVELS, SWELLING_LEVELS } from '@/shared/const/recovery-log.const';

/**
 * One patient-reported point on the recovery curve (PRD 06 §3).
 *
 * The clinic sees a trajectory rather than the single snapshot a checkup gives. That is the whole
 * value: a pain score of 5 means nothing alone, and means two different things depending on
 * whether the day before was 3 or 8.
 *
 * `dayIndex` is stored rather than derived at read time. It is days since the procedure, and the
 * chart's x-axis — recomputing it later from `loggedAt` would silently change every historical
 * point if a plan's start date were ever corrected.
 *
 * This is patient-reported data, not clinical assessment. Nothing here is scored, ranked or
 * escalated: it is what somebody typed about their own recovery, and treating it as triage would
 * be the same mistake the symptom-report queue deliberately avoids.
 */
const RecoveryLogSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    carePlanId: { type: Schema.Types.ObjectId, ref: 'CarePlan', required: true, index: true },

    loggedAt: { type: Date, required: true },
    dayIndex: { type: Number, required: true, min: 0 },

    painLevel: { type: Number, required: true, min: 0, max: 10 },
    swelling: { type: String, enum: SWELLING_LEVELS, required: true },
    /** Optional: a patient who wants to report pain and stop should not be blocked on a mood. */
    mood: { type: String, enum: MOOD_LEVELS, required: false, default: null },
    note: { type: String, required: false, default: '', maxlength: 2000 },

    /**
     * Photographs attached to this entry. Ids into `PatientPhoto`, never URLs — the bytes are in
     * the private store and reachable only through the guarded proxy.
     */
    photoIds: { type: [Schema.Types.ObjectId], ref: 'PatientPhoto', required: true, default: [] },
  },
  { timestamps: true }
);

/** The clinic's chart: one patient's curve, in order. */
RecoveryLogSchema.index({ patientId: 1, dayIndex: 1 });
/** One entry per patient per day of recovery — the prompt asks once, and a duplicate is a resubmit. */
RecoveryLogSchema.index({ carePlanId: 1, dayIndex: 1 }, { unique: true });

export type RecoveryLogDocument = InferSchemaType<typeof RecoveryLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RecoveryLogModel =
  mongoose.models.RecoveryLog || mongoose.model('RecoveryLog', RecoveryLogSchema);
