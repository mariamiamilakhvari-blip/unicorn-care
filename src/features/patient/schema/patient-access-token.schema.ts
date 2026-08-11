import mongoose, { Schema, InferSchemaType } from 'mongoose';

const PatientAccessTokenSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    // SHA-256 of the raw magic-link token. The raw token is shown to staff once and never stored.
    tokenHash: { type: String, required: true, unique: true },
    /*
      There is deliberately no `expiresAt`. A patient access link stays valid until someone
      revokes it, because a patient locked out of their own recovery plan mid-recovery is the
      worse failure. Rows written before this change may still carry the field; dropping it from
      the schema is what stops it being read, so those links come back to life rather than
      needing a migration.

      `revokedAt` is now the only thing that ends a link, which makes it the only control a
      clinic has when one leaks.
    */
    revokedAt: { type: Date, required: false, default: null },
    lastUsedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

PatientAccessTokenSchema.index({ patientId: 1, revokedAt: 1 });

export type PatientAccessTokenDocument = InferSchemaType<typeof PatientAccessTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PatientAccessTokenModel =
  mongoose.models.PatientAccessToken ||
  mongoose.model('PatientAccessToken', PatientAccessTokenSchema);
