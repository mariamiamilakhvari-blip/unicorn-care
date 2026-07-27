import mongoose, { Schema, InferSchemaType } from 'mongoose';

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: false, default: '' },
    avatar: { type: String, required: false },
    role: {
      type: String,
      enum: ['user', 'admin', 'clinic_owner', 'clinic_staff'],
      default: 'user',
      required: true,
    },
    // Tenancy key — every clinical query filters on it. Null for platform users/admins.
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: false, default: null },
    jobTitle: { type: String, required: false, default: '' },
  },
  { timestamps: true }
);

UserSchema.index({ clinicId: 1, role: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UserModel =
  mongoose.models.User || mongoose.model('User', UserSchema);
