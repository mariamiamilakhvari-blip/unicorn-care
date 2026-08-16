import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { DATA_REQUEST_KINDS, DATA_REQUEST_STATUSES } from '@/shared/const/data-request.const';

/**
 * A patient asking their clinic to correct or erase what is held about them.
 *
 * The Law of Georgia on Personal Data Protection gives the data subject both rights, and the Law
 * on Patient Rights gives the same person a right to have their record corrected. Neither is
 * self-executing here, and deliberately so: correcting a clinical record is a clinical act, and
 * erasure runs straight into the retention the Law on Health Care mandates. A portal button that
 * deleted a medication history on the spot would put the clinic in breach of the statute that
 * requires it to keep one.
 *
 * So the request is a record, not an action. The patient files it, the clinic acts on it, and both
 * the outcome and — when the answer is no — the reason are stored. `refused` is a first-class
 * status rather than a failure, because "we are required to keep this for N years" is a lawful
 * answer that the patient is entitled to receive in writing.
 *
 * Contact and identity fields are erasable; the clinical log behind them is not. `RETENTION` in
 * `retention.const.ts` is where that line is drawn, and `applyErasureService` is what applies it.
 */
const DataRequestSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    kind: { type: String, enum: DATA_REQUEST_KINDS, required: true },
    status: {
      type: String,
      enum: DATA_REQUEST_STATUSES,
      default: 'open',
      required: true,
    },
    /*
      What the patient says is wrong, in their own words. Required for a correction — a clinic
      cannot act on "something is wrong" — and optional for an erasure, which needs no reason
      under the Law on Personal Data Protection.
    */
    detail: { type: String, required: false, default: '' },
    /*
      The clinic's answer, and the whole point of `refused` existing. A refusal without a stated
      basis is not a lawful response to a data subject request, so this is what the resolve path
      requires before it will record one.
    */
    resolution: { type: String, required: false, default: '' },
    requestedAt: { type: Date, required: true },
    resolvedAt: { type: Date, required: false, default: null },
    /** The staff user who answered. Null while the request is open. */
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    ipAddress: { type: String, required: false, default: '' },
  },
  { timestamps: true }
);

/** The clinic's queue: open requests first, oldest first — the statutory clock starts at filing. */
DataRequestSchema.index({ clinicId: 1, status: 1, requestedAt: 1 });
/** The patient's own history of what they have asked for. */
DataRequestSchema.index({ patientId: 1, requestedAt: -1 });

export type DataRequestDocument = InferSchemaType<typeof DataRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DataRequestModel =
  mongoose.models.DataRequest || mongoose.model('DataRequest', DataRequestSchema);
