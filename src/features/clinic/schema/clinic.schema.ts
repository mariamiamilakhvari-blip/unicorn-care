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
      The clinic's contact address — where the platform writes to the practice, as distinct from
      `User.email`, which is a person's sign-in credential and is not safe to edit from a profile
      form. The DPA undertakes to send breach notices "to the contact address the clinic holds on
      its account", and until this existed there was no such address to send them to.

      Optional, like the rest of the profile: it is needed to reach a clinic, not to open an
      account, and a required field here would strand every clinic created before it shipped.
    */
    email: { type: String, required: false, default: '' },
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
      Evidence, not a flag. The Law of Georgia on Personal Data Protection puts the burden of
      proof on the controller, who has to demonstrate that consent was given — which a bare boolean
      cannot do: it says nothing about when, or to which wording. Written server-side at creation
      from `clock.now()` — a timestamp the browser supplies is not evidence of anything. Optional so clinics created before this shipped still load.
    */
    consent: {
      version: { type: String, required: false, default: '' },
      acceptedAt: { type: Date, required: false, default: null },
    },
    /*
      The Data Processing Agreement, recorded separately from the consent block above.

      Separate because it is a contract rather than a checkbox: the Law of Georgia on Personal Data
      Protection requires the controller–processor relationship to be governed by a written
      agreement, so what has to survive is which version was executed and when — the same things a
      countersigned copy would show.

      There is no `accepted` boolean, and its absence is the point. This replaced a US-only
      Business Associate Agreement that a clinic outside the United States could decline, which
      made "did they accept" worth recording. Under Georgian law every controller engaging a
      processor needs this agreement, so it is mandatory, the schema rejects a registration without
      it, and a stored flag could only ever read `true`. A field with one reachable value is not
      evidence — it is an invitation to write a branch for a case that cannot occur.

      The IP is supporting evidence for an executed contract, taken from the request headers
      server-side. It is not proof of identity — a header can be forged — and nothing authorises
      off it; it exists so an acceptance has a provenance beyond a bare timestamp. Optional
      throughout so clinics created before this shipped still load.
    */
    dpa: {
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
    /*
      When paid access ended, and the instant the 14-day reminder grace period is measured from.

      Stored rather than derived because there is nothing to derive it from: a trial expiry is
      readable off `trialEndsAt`, but a failed renewal or a cancellation leaves no timestamp of its
      own, and `updatedAt` moves every time anyone edits the clinic's phone number. A grace period
      anchored to that would silently restart itself.

      Written by the webhook and by self-cancellation, and cleared the moment a subscription goes
      active again — so a clinic that lapses, pays, and lapses again gets a fresh fourteen days
      rather than the remains of the old window. Null while the subscription is live, and also null
      on clinics that lapsed before this field existed; the grace helper treats that as a window
      that has already closed, since a clinic in that state has been lapsed far longer than the
      grace period anyway.
    */
    subscriptionEndedAt: { type: Date, required: false, default: null },

    /*
      Denormalised rating standing, recomputed from the ratings themselves on every submission —
      never incremented. A running average drifts the first time a write is lost or replayed and
      nothing would ever notice, whereas a clinic has tens of ratings, so recomputing is free.

      These are the raw averages. The threshold below which they must not be *shown* lives in
      `MIN_RATINGS_FOR_AVERAGE`, and is applied when the summary is built: storing a suppressed
      average would mean losing the real one the moment the fifth rating arrived.
    */
    ratingCount: { type: Number, required: true, default: 0 },
    avgDoctorScore: { type: Number, required: true, default: 0 },
    avgClinicScore: { type: Number, required: true, default: 0 },

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
