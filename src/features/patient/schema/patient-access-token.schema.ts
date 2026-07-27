import mongoose, { Schema, InferSchemaType } from 'mongoose';

const PatientAccessTokenSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
    // SHA-256 of the raw magic-link token. The raw token is shown to staff once and never stored.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
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
