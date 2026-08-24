import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * A bounded, reusable link that lets a patient get a portal session on a device.
 *
 * Deliberately *not* the same thing as `PatientAccessToken`. That one is the durable credential and
 * has no expiry, because a patient locked out mid-recovery is the worse failure. This one exists to
 * travel through an inbox: it expires, and redeeming it mints a fresh access token rather than
 * carrying one.
 *
 * **Reusable until `expiresAt`, not spent on first use.** Single use was the wrong model for a link
 * whose window is the patient's whole recovery. The same message is the way in on a phone in week
 * one and on a laptop in week six, and under the old rule the second device was told the link was
 * invalid — the lockout this credential exists to prevent, arriving through the credential itself.
 *
 * What bounds it instead is the window and the row. `expiresAt` now tracks the end of the plan's
 * rehab, and revocation *deletes* the row rather than marking it — see `revokeAccessService`. The
 * cost is real and was accepted deliberately: anyone holding the email can open the portal until it
 * expires, so a forwarded message is a forwarded credential.
 *
 * `usedAt` is the first redemption, kept for the audit trail alone. It stops nothing.
 */
const PatientPortalLinkSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    /** SHA-256 of the raw token. The raw value exists only in the email that was sent. */
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    /** When it was first redeemed. Informational — redemption never reads it. */
    usedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

/*
  A TTL index, unlike on the access tokens: a link that outlived its window must be unusable even if
  a lookup ever forgot to check the date. That backstop matters more now than it did when the row
  was also spent on first use — the date is the only thing left bounding it. Mongo sweeps on a
  roughly one-minute cycle, so `expiresAt` is still compared in the service; the index is cleanup,
  never the check.
*/
PatientPortalLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PatientPortalLinkDocument = InferSchemaType<typeof PatientPortalLinkSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PatientPortalLinkModel =
  mongoose.models.PatientPortalLink || mongoose.model('PatientPortalLink', PatientPortalLinkSchema);
