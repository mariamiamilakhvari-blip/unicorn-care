import mongoose, { InferSchemaType, Schema } from 'mongoose';

/** The optional detail scores, each on the same 1–5 scale as the headline ones. */
const SubscoreSchema = new Schema(
  {
    communication: { type: Number, min: 1, max: 5, required: false, default: null },
    cleanliness: { type: Number, min: 1, max: 5, required: false, default: null },
    painManagement: { type: Number, min: 1, max: 5, required: false, default: null },
    resultSatisfaction: { type: Number, min: 1, max: 5, required: false, default: null },
  },
  { _id: false }
);

/**
 * A patient's rating of one procedure (PRD 06 §1).
 *
 * Solicited only once rehabilitation has finished. An unhappy day-3 patient is rating their pain,
 * not their outcome, and asking mid-recovery would produce a number that says more about where
 * they are in healing than about the care they received.
 *
 * `procedureId` is unique: one rating per procedure, so a clinic cannot accumulate scores by
 * asking twice, and a patient cannot be nagged into revising one.
 *
 * `operatorUserId` is copied from the procedure at submission rather than read through it later.
 * The clinic's staff list changes — a surgeon leaves, an account is deactivated — and a rating
 * has to stay attached to whoever actually operated.
 */
const RatingSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    procedureId: {
      type: Schema.Types.ObjectId,
      ref: 'Procedure',
      required: true,
      unique: true,
    },
    operatorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },

    doctorScore: { type: Number, min: 1, max: 5, required: true },
    clinicScore: { type: Number, min: 1, max: 5, required: true },
    subscores: { type: SubscoreSchema, required: false, default: () => ({}) },
    comment: { type: String, required: false, default: '', maxlength: 2000 },

    submittedAt: { type: Date, required: true },
    /*
      Editable for 24 hours, then fixed. A rating a patient can revise indefinitely is a rating a
      clinic can ask them to revise; a rating that locks the instant it is submitted punishes a
      slip of the finger on a five-point scale.
    */
    editableUntil: { type: Date, required: true },

    /** The clinic may reply, and may never delete. Its answer sits beside the rating, not over it. */
    clinicResponse: { type: String, required: false, default: '', maxlength: 2000 },
    respondedAt: { type: Date, required: false, default: null },

    /** Reserved for a future public profile. Nothing reads it yet; nothing is published. */
    isPublic: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

// The clinic's own list, newest first.
RatingSchema.index({ clinicId: 1, submittedAt: -1 });
// Per-doctor aggregates.
RatingSchema.index({ operatorUserId: 1 });

export type RatingDocument = InferSchemaType<typeof RatingSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RatingModel = mongoose.models.Rating || mongoose.model('Rating', RatingSchema);
