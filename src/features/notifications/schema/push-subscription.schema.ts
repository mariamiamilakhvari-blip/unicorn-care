import mongoose, { Schema, InferSchemaType } from 'mongoose';

const PushSubscriptionSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    authKey: { type: String, required: true },
    userAgent: { type: String, required: false, default: '' },
    locale: { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
    // Set false on a 404/410 from the push service — the browser dropped the subscription.
    isActive: { type: Boolean, default: true, required: true },
    failureCount: { type: Number, default: 0, required: true },
    lastSuccessAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ patientId: 1, isActive: 1 });

export type PushSubscriptionDocument = InferSchemaType<typeof PushSubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PushSubscriptionModel =
  mongoose.models.PushSubscription ||
  mongoose.model('PushSubscription', PushSubscriptionSchema);
