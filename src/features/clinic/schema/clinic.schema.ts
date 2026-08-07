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
    /*
      Tax ID / VAT / business registration number, held as free text on purpose. Every country
      formats this differently — DE123456789, 12-3456789, 204567891 — and a clinic that cannot
      enter its own real number is a clinic that cannot be invoiced. Optional: it is needed at
      billing time, not at sign-up, and blocking onboarding on it loses accounts.
    */
    taxId: { type: String, required: false, default: '' },
    logoUrl: { type: String, required: false, default: '' },
    locale: { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
    // All reminder wall-clock times are resolved in this IANA zone; instants are stored in UTC.
    timezone: { type: String, required: true, default: 'Asia/Tbilisi' },
    /*
      Evidence, not a flag. GDPR Art. 7(1) asks the controller to demonstrate that consent was
      given, which a bare boolean cannot do: it says nothing about when, or to which wording.
      Written server-side at creation from `clock.now()` — a timestamp the browser supplies is
      not evidence of anything. Optional so clinics created before this shipped still load.
    */
    consent: {
      version: { type: String, required: false, default: '' },
      acceptedAt: { type: Date, required: false, default: null },
    },
    /*
      The HIPAA Business Associate Agreement, recorded separately from the consent block above.

      `accepted` is stored here where the other consents' booleans are not, and the difference is
      deliberate: those are all mandatory, so a row of `true` says nothing, while this one is only
      required of US clinics. Whether it was given is therefore real information.

      The IP is supporting evidence for an executed contract, taken from the request headers
      server-side. It is not proof of identity — a header can be forged — and nothing authorises
      off it; it exists so an acceptance has a provenance beyond a bare timestamp. Optional
      throughout so clinics created before this shipped still load.
    */
    baa: {
      accepted: { type: Boolean, required: false, default: false },
      version: { type: String, required: false, default: '' },
      acceptedAt: { type: Date, required: false, default: null },
      ip: { type: String, required: false, default: '' },
    },
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

    /* Set from verified Dodo webhooks only — never from anything the browser sends. */
    dodoCustomerId: { type: String, required: false, default: null },
    dodoSubscriptionId: { type: String, required: false, default: null },
  },
  { timestamps: true }
);

ClinicSchema.index({ ownerId: 1 });

export type ClinicDocument = InferSchemaType<typeof ClinicSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ClinicModel =
  mongoose.models.Clinic || mongoose.model('Clinic', ClinicSchema);
