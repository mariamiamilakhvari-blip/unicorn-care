import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ClinicSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    country: { type: String, required: false, default: '' },
    city: { type: String, required: false, default: '' },
    addressLine: { type: String, required: false, default: '' },
    phone: { type: String, required: false, default: '' },
    logoUrl: { type: String, required: false, default: '' },
    locale: { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
    // All reminder wall-clock times are resolved in this IANA zone; instants are stored in UTC.
    timezone: { type: String, required: true, default: 'Asia/Tbilisi' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

ClinicSchema.index({ ownerId: 1 });

export type ClinicDocument = InferSchemaType<typeof ClinicSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ClinicModel =
  mongoose.models.Clinic || mongoose.model('Clinic', ClinicSchema);
