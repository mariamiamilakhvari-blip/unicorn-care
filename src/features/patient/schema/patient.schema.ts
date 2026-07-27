import mongoose, { Schema, InferSchemaType } from 'mongoose';

const PatientSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    // Display only — the product has no SMS channel, this is never used to send anything.
    phone: { type: String, required: false, default: '' },
    // Contact detail for the clinic's own records only. The product never sends email.
    email: { type: String, required: false, default: '' },
    dateOfBirth: { type: Date, required: false, default: null },
    sex: {
      type: String,
      enum: ['female', 'male', 'other', 'unspecified'],
      default: 'unspecified',
      required: true,
    },
    locale: { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
    allergies: { type: [String], default: [] },
    notes: { type: String, required: false, default: '' },
    isArchived: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

PatientSchema.index({ clinicId: 1, lastName: 1 });

export type PatientDocument = InferSchemaType<typeof PatientSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PatientModel =
  mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
