import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { CONTACT_METHODS, DEFAULT_CONTACT_METHOD, SYMPTOM_REPORT_STATUSES } from '@/shared/const/recovery.const';

/**
 * A patient saying "something doesn't feel right" (PRD 06 §2).
 *
 * This is a queue, not a triage engine. Nothing here scores, ranks, or decides urgency — the row
 * is stored and surfaced to the clinic, and a clinician makes every judgement. `severity` is only
 * the label of the warning item the patient tapped, never an assessment produced by the system.
 */
const SymptomReportSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    procedureId: { type: Schema.Types.ObjectId, ref: 'Procedure', required: false, default: null },
    /*
      The plan the patient was part-way through when they wrote in, resolved at filing time.

      Recorded because "on day 3 of a 21-day plan" is most of what makes a complaint legible to
      the clinician reading it, and the plan is the thing that gets extended, paused or corrected
      in response. Null is ordinary and must stay allowed: a patient can report a symptom before a
      plan is activated, after one finishes, or with none at all, and a report is never worth
      refusing because there is nothing to attach it to.
    */
    planId: { type: Schema.Types.ObjectId, ref: 'CarePlan', required: false, default: null },

    // Copied from the guide item the patient selected, or empty for a free-text report.
    warningTitle: { type: String, required: false, default: '' },
    severity: { type: String, required: false, default: '' },
    note: { type: String, required: false, default: '' },

    /*
      How the patient asked to be reached about *this* report, and on what number.

      Both are recorded on the report rather than on the patient, because both are answers about
      one moment: someone recovering abroad on a foreign SIM wants a WhatsApp message back on that
      number this week, and a call on their home number the month after. Writing either onto the
      patient record would overwrite a detail the clinic entered, from a form the clinic never saw.

      `contactPhone` empty means "use the number you already have". It is not defaulted to a copy
      of the patient's phone at write time on purpose — a stored copy silently goes stale the first
      time the clinic corrects a typo, and the fallback keeps the two in step.
    */
    contactMethod: {
      type: String,
      enum: CONTACT_METHODS,
      required: true,
      default: DEFAULT_CONTACT_METHOD,
    },
    contactPhone: { type: String, required: false, default: '' },

    status: {
      type: String,
      enum: SYMPTOM_REPORT_STATUSES,
      required: true,
      default: 'needs_review',
    },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    reviewedAt: { type: Date, required: false, default: null },
    clinicNote: { type: String, required: false, default: '' },
  },
  { timestamps: true }
);

// The clinic's review queue: open reports first, newest first.
SymptomReportSchema.index({ clinicId: 1, status: 1, createdAt: -1 });

export type SymptomReportDocument = InferSchemaType<typeof SymptomReportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SymptomReportModel =
  mongoose.models.SymptomReport || mongoose.model('SymptomReport', SymptomReportSchema);
