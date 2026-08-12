import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * A short-lived, single-use link that lets a patient get a portal session on a new device.
 *
 * Deliberately *not* the same thing as `PatientAccessToken`. That one is the durable credential and
 * has no expiry, because a patient locked out mid-recovery is the worse failure. This one only
 * exists to travel through an inbox, and everything that travels through an inbox outlives the
 * message: it expires, it is spent on first use, and redeeming it mints a fresh access token rather
 * than carrying one.
 *
 * The split is what lets a patient email link finally work without a standing key to a medical
 * record sitting in a mailbox forever.
 */
const PatientPortalLinkSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    /** SHA-256 of the raw token. The raw value exists only in the email that was sent. */
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

/*
  A TTL index, unlike on the access tokens: a spent request link is litter, and one that outlived
  its window must be unusable even if a lookup ever forgot to check the date. Mongo sweeps on a
  roughly one-minute cycle, so `expiresAt` is still compared in the service — the index is cleanup,
  never the check.
*/
PatientPortalLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PatientPortalLinkDocument = InferSchemaType<typeof PatientPortalLinkSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PatientPortalLinkModel =
  mongoose.models.PatientPortalLink || mongoose.model('PatientPortalLink', PatientPortalLinkSchema);
