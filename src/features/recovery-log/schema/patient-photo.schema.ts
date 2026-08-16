import mongoose, { InferSchemaType, Schema } from 'mongoose';

/**
 * A post-operative photograph (PRD 06 §3).
 *
 * The row holds a `pathname` and deliberately no `url`. A private blob's URL is not usable
 * without a signed request, and storing one would invite somebody rendering it straight into an
 * `<img src>` — which fails silently today and would leak the moment anyone flipped the blob
 * public. The bytes are reachable only through the proxy route, which checks who is asking.
 *
 * `consent` is recorded per upload, not once per patient. Agreeing that the clinic may hold
 * photographs is not the same as agreeing to this photograph, and a single account-level flag
 * cannot tell the two apart afterwards.
 */
const PatientPhotoSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    /** Set once the recovery log itself exists; the photo can be stored before it is attached. */
    recoveryLogId: { type: Schema.Types.ObjectId, ref: 'RecoveryLog', required: false, default: null },

    /** Path inside the private half of the store. Always under `PRIVATE_BLOB_PREFIX`. */
    pathname: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },

    /*
      Evidence, not a checkbox. The Law of Georgia on Personal Data Protection treats a
      photograph of a healing surgical site as health data, so what matters afterwards is which
      wording was agreed and when — a bare boolean answers neither.
    */
    consent: {
      version: { type: String, required: true },
      grantedAt: { type: Date, required: true },
    },

    uploadedAt: { type: Date, required: true },
    /** Who put it there. A patient uploading their own recovery is the expected case. */
    uploadedBy: { type: String, enum: ['patient', 'clinic'], required: true },
  },
  { timestamps: true }
);

PatientPhotoSchema.index({ patientId: 1, uploadedAt: -1 });

export type PatientPhotoDocument = InferSchemaType<typeof PatientPhotoSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PatientPhotoModel =
  mongoose.models.PatientPhoto || mongoose.model('PatientPhoto', PatientPhotoSchema);
