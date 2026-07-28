import mongoose, { Schema, InferSchemaType } from 'mongoose';

import { PLAN_KEYS } from '@/shared/const/plan.const';
import { SUBSCRIPTION_STATUSES } from '@/shared/const/subscription.const';

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

    /*
      Subscription state. Every clinic starts on the 7-day trial, so `plan` is never absent and
      the enforcement path has no "unknown plan" branch to guess at.

      `subscriptionStatus` is deliberately separate from `plan`: a lapsed Standard clinic keeps
      `plan: 'standard'` with `status: 'past_due'`, so restoring access is a status change and no
      historical record of what they were paying for is lost.
    */
    plan: { type: String, enum: PLAN_KEYS, default: 'trial', required: true },
    trialEndsAt: { type: Date, required: false, default: null },
    subscriptionStatus: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: 'trialing',
      required: true,
    },
    planRenewsAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

ClinicSchema.index({ ownerId: 1 });

export type ClinicDocument = InferSchemaType<typeof ClinicSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ClinicModel =
  mongoose.models.Clinic || mongoose.model('Clinic', ClinicSchema);
