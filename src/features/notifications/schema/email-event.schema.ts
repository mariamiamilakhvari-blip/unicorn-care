import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { EMAIL_EVENT_KINDS } from '@/shared/const/email-delivery.const';

/**
 * What the mail provider reported about one message.
 *
 * An append-only log, separate from the suppression state on the patient. The patient record
 * answers "may we send to this address"; this answers "why", and the clinic needs the second to
 * act — "no longer deliverable" is not something a clinic can fix, whereas "mailbox does not
 * exist, reported 3 August" is a phone call to the patient.
 *
 * `email` is stored on the event rather than read from the patient at display time, because the
 * clinic corrects the address in response to exactly these events. Without a copy, fixing a typo
 * would silently rewrite the history of the address that failed.
 */
const EmailEventSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    /** The address as it was when the provider tried it. */
    email: { type: String, required: true },
    kind: { type: String, enum: EMAIL_EVENT_KINDS, required: true },
    /** `hard` or `soft` for a bounce; empty for anything else. */
    bounceType: { type: String, required: false, default: '' },
    /** The provider's own wording, kept verbatim — it is what tells a clinic what to fix. */
    message: { type: String, required: false, default: '' },
    /** The provider's message id, so a duplicate delivery of the same webhook is recognisable. */
    providerId: { type: String, required: false, default: '', index: true },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// The clinic view lists a patient's events newest first.
EmailEventSchema.index({ patientId: 1, occurredAt: -1 });

export type EmailEventDocument = InferSchemaType<typeof EmailEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const EmailEventModel =
  mongoose.models.EmailEvent || mongoose.model('EmailEvent', EmailEventSchema);
