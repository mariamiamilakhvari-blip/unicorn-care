import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { WARNING_SEVERITIES } from '@/shared/const/recovery.const';

/**
 * Clinic-authored "what is expected / what is a warning sign" content for one procedure type,
 * in one language (PRD 06 §2).
 *
 * Content is always written by the clinic and never generated. This is the highest-liability
 * surface in the product: it is reference material a post-operative patient reads unsupervised,
 * so nothing here is inferred, summarised, or produced by a model.
 */
const RecoveryGuideSchema = new Schema(
  {
    // Null marks a platform-provided default that any clinic may clone and edit.
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: false, default: null, index: true },
    manipulationType: { type: String, required: true, index: true },
    locale: { type: String, enum: ['ka', 'en'], required: true },

    expected: [
      {
        title: { type: String, required: true },
        description: { type: String, required: false, default: '' },
        fromDay: { type: Number, required: true, default: 0 },
        toDay: { type: Number, required: true, default: 0 },
      },
    ],

    warning: [
      {
        title: { type: String, required: true },
        description: { type: String, required: false, default: '' },
        severity: { type: String, enum: WARNING_SEVERITIES, required: true },
      },
    ],

    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

// One guide per clinic, procedure type and language. The platform defaults use a null clinicId.
RecoveryGuideSchema.index({ clinicId: 1, manipulationType: 1, locale: 1 }, { unique: true });

export type RecoveryGuideDocument = InferSchemaType<typeof RecoveryGuideSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RecoveryGuideModel =
  mongoose.models.RecoveryGuide || mongoose.model('RecoveryGuide', RecoveryGuideSchema);
