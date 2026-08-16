import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { CONSENT_SOURCES, CONSENT_TYPES } from '@/shared/const/consent-type.const';

/**
 * One consent, as evidence.
 *
 * The Law of Georgia on Personal Data Protection puts the burden of proof on the controller: it is
 * not enough to know that a patient currently consents, the clinic has to be able to show what was
 * agreed to, when, and on what wording. The patient record already carries the *state* — see
 * `notificationsRevokedAt` on `Patient`, which is what the dispatcher reads — and this collection
 * carries the *history* that state was derived from. Neither replaces the other: a boolean cannot
 * answer "what did they agree to in March", and an audit log is too expensive to consult on every
 * one of a sweep's five hundred sends.
 *
 * Rows are append-only with exactly one permitted mutation: `revokedAt`, set once, by
 * `consentRepository.revoke`. There is no update path for any other field and no delete path at
 * all — a consent record that can be edited after the fact is not evidence of anything. Correcting
 * a mistake means writing a new row, which is why `grantedAt` is stored rather than leaning on
 * `createdAt`: a clinic entering a form signed last week is recording consent given last week, and
 * the row's own creation time is a separate fact worth keeping beside it.
 *
 * `ipAddress` is supporting evidence and never an identifier: a header can be forged by anything
 * talking to the origin directly, so nothing is ever authorised on the strength of it. It is
 * `unknown` rather than empty when no header carried one — see `clientIp`.
 */
const ConsentRecordSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    consentType: { type: String, enum: CONSENT_TYPES, required: true },
    source: { type: String, enum: CONSENT_SOURCES, required: true },
    /*
      When consent was given, which is not necessarily when this row was written. A clinic entering
      a patient is attesting to a form already signed, and `createdAt` would date the paperwork to
      the day of data entry.
    */
    grantedAt: { type: Date, required: true },
    /*
      Null while the consent stands. Set once, at withdrawal, and never cleared: re-consenting
      writes a new row, so a patient who turns reminders off and on again leaves two rows and a
      readable history rather than one row that has forgotten the gap.
    */
    revokedAt: { type: Date, required: false, default: null },
    /** Who withdrew it, when it was withdrawn. Null while `revokedAt` is null. */
    revokedSource: { type: String, enum: [...CONSENT_SOURCES, ''], required: false, default: '' },
    /*
      The version of the wording that was on screen. Without it, revising a checkbox silently
      rewrites what every earlier patient is recorded as having agreed to.
    */
    consentTextVersion: { type: String, required: true },
    /** Supporting evidence only — see the class comment. Never used to authorise anything. */
    ipAddress: { type: String, required: false, default: '' },
    /*
      Free text the clinic adds when relaying a withdrawal made in person or by phone, so the
      record can say how it arrived. Never shown to the dispatcher and never used as a basis.
    */
    note: { type: String, required: false, default: '' },
  },
  { timestamps: true }
);

/** The live-consent lookup: this patient, this purpose, not yet withdrawn. */
ConsentRecordSchema.index({ patientId: 1, consentType: 1, revokedAt: 1 });
/** The clinic's own audit view, newest first. */
ConsentRecordSchema.index({ clinicId: 1, createdAt: -1 });

export type ConsentRecordDocument = InferSchemaType<typeof ConsentRecordSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ConsentRecordModel =
  mongoose.models.ConsentRecord || mongoose.model('ConsentRecord', ConsentRecordSchema);
