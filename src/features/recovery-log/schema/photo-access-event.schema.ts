import mongoose, { InferSchemaType, Schema } from 'mongoose';

/**
 * What happened to the photograph. `denied` rows are the interesting ones for reads; `deleted`
 * is here because a deletion is the one event that leaves nothing else behind — once the bytes
 * and the row are gone, this log is the only remaining evidence that the photograph existed and
 * that someone removed it, which is exactly what a patient asking "was it deleted?" needs.
 */
export const PHOTO_ACCESS_OUTCOMES = ['served', 'denied', 'deleted'] as const;

export const PHOTO_VIEWER_TYPES = ['clinic_user', 'patient'] as const;

/**
 * Every attempt to read a patient photograph, successful or not.
 *
 * Append-only, and the reason the proxy route exists at all. A presigned URL handed to a browser
 * can be used, forwarded and re-used without anything here ever hearing about it — issuing one
 * can be logged, but its use cannot, and "we issued a link" is not an access record.
 *
 * Refusals are written as well as successes. A clinic user reaching for a photograph belonging to
 * another clinic's patient is precisely the event worth having a record of, and it is the one a
 * log of successes alone would miss.
 */
const PhotoAccessEventSchema = new Schema(
  {
    photoId: { type: Schema.Types.ObjectId, ref: 'PatientPhoto', required: true, index: true },
    /** Denormalised so a purge of the photo row leaves the access history readable. */
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: false, default: null },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: false, default: null, index: true },

    viewerType: { type: String, enum: PHOTO_VIEWER_TYPES, required: true },
    /** Null when the viewer is the patient — they have no user account. */
    viewerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },

    outcome: { type: String, enum: PHOTO_ACCESS_OUTCOMES, required: true },
    /** Why a read was refused, for the denied rows. Empty on success. */
    reason: { type: String, required: false, default: '' },
    viewedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

PhotoAccessEventSchema.index({ photoId: 1, viewedAt: -1 });

export type PhotoAccessEventDocument = InferSchemaType<typeof PhotoAccessEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PhotoAccessEventModel =
  mongoose.models.PhotoAccessEvent || mongoose.model('PhotoAccessEvent', PhotoAccessEventSchema);
