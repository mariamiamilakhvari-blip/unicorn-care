import mongoose, { Schema, InferSchemaType } from 'mongoose';

const PasswordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /*
      SHA-256 of the raw token, never the token itself. The raw value exists only inside the email
      that carries it — a database read yields no working reset link, which is what keeps a leaked
      backup from being a set of live account takeovers.
    */
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    /* Set the moment a token is spent. Single use: a reset link in an inbox works exactly once. */
    usedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

PasswordResetTokenSchema.index({ userId: 1, usedAt: 1 });

export type PasswordResetTokenDocument = InferSchemaType<typeof PasswordResetTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PasswordResetTokenModel =
  mongoose.models.PasswordResetToken ||
  mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
