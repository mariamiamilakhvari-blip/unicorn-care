import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { SUPPRESSION_REASONS } from '@/shared/const/email-delivery.const';

const PatientSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    // Display only — the product has no SMS channel, this is never used to send anything.
    phone: { type: String, required: false, default: '' },
    // Contact detail for the clinic's own records only. The product never sends email.
    email: { type: String, required: false, default: '' },
    dateOfBirth: { type: Date, required: false, default: null },
    sex: {
      type: String,
      enum: ['female', 'male', 'other', 'unspecified'],
      default: 'unspecified',
      required: true,
    },
    locale: { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
    allergies: { type: [String], default: [] },
    notes: { type: String, required: false, default: '' },
    /*
      The clinic's attestation that it holds this patient's consent, with the wording version and
      the moment it was given. Storing the booleans would say nothing — all six are mandatory, so
      the request could not have succeeded otherwise. What has to survive is the timestamp and the
      version. Optional so patients created before this shipped still load.
    */
    consent: {
      version: { type: String, required: false, default: '' },
      confirmedAt: { type: Date, required: false, default: null },
    },
    /*
      Email deliverability state for this patient's address.

      Held on the patient rather than in a lookup table because every send already loads this
      record, so the pre-send check costs nothing — and because the address itself lives here, so
      the two cannot drift apart when a clinic corrects a typo.

      `emailSuppressedAt` being null is the normal state. Suppression stops email only: push is a
      separate channel with its own delivery record, and a patient with a dead inbox must still
      get the notification that can wake their phone.
    */
    emailSuppressedAt: { type: Date, required: false, default: null },
    emailSuppressionReason: {
      type: String,
      enum: SUPPRESSION_REASONS,
      required: false,
      default: '',
    },
    /* Consecutive soft bounces. Any delivery resets it, so this measures a run, not a lifetime. */
    emailSoftBounces: { type: Number, required: false, default: 0 },
    isArchived: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

PatientSchema.index({ clinicId: 1, lastName: 1 });

export type PatientDocument = InferSchemaType<typeof PatientSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PatientModel =
  mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
