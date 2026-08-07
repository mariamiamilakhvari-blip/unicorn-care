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
    /*
      Whether this account may sign in. Deactivation rather than deletion, because a `User` row is
      referenced by the clinic that owns it, the procedures that name the operating doctor, and
      the guides it last edited — removing the row leaves those pointing at nothing, and the only
      path that unwinds a clinic properly is `deleteClinicService`.

      Defaults true so every existing account keeps working; a deactivated account is refused at
      the credentials check and on every token refresh, so an open session dies at its next
      refresh rather than lasting until it expires.
    */
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

UserSchema.index({ clinicId: 1, role: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UserModel =
  mongoose.models.User || mongoose.model('User', UserSchema);
