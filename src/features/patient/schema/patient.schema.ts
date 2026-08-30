import mongoose, { InferSchemaType, Schema } from 'mongoose';

import { SUPPRESSION_REASONS } from '@/shared/const/email-delivery.const';

const PatientSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    // Display only — the product has no SMS channel, this is never used to send anything.
    phone: { type: String, required: false, default: '' },
    /*
      Where this patient's reminders, portal links and summaries are sent. Not an identifier and
      deliberately not unique: a patient is a clinic's record rather than a login, so the same
      address may sit on several — a family sharing an inbox, one person treated at two clinics.
      Readers must handle that; see `patientRepository.findAllByEmail`.
    */
    email: { type: String, required: false, default: '' },
    /*
      Age in years as the clinic entered it, not derived from anything. Null means never asked.

      A snapshot, and it does not age with the patient: this holds no birth date to recompute
      from, so a record entered at 35 still reads 35 a year later. That is the trade the field
      makes — one number a clinic can type at intake, against a value that drifts if the record
      outlives the treatment. Bounds live in `MIN_PATIENT_AGE`/`MAX_PATIENT_AGE`.
    */
    age: { type: Number, required: false, default: null },
    sex: {
      type: String,
      enum: ['female', 'male', 'other', 'unspecified'],
      default: 'unspecified',
      required: true,
    },
    locale: { type: String, enum: ['ka', 'en'], default: 'ka', required: true },
    /*
      The IANA zone the patient is actually living in, detected from their device the first time
      they open the portal and re-checked on every visit.

      Empty means "inherit the clinic's", which is the right answer for a patient who has never
      opened the portal and the reason this is not defaulted to a real zone: a plan must not be
      built against a guess when the clinic's own zone is the better one.

      It exists because recovery outlives the stay. A patient operated on in Tbilisi and recovering
      at home in Amsterdam was still being reminded on Tbilisi wall-clock, which is two hours out —
      a 09:30 dose announced at 07:30. `timezoneUpdatedAt` records when the move was noticed, which
      is what a clinic asking "why did this patient's schedule shift" needs to see.
    */
    timezone: { type: String, required: false, default: '' },
    timezoneUpdatedAt: { type: Date, required: false, default: null },
    allergies: { type: [String], default: [] },
    notes: { type: String, required: false, default: '' },
    /*
      The clinic's attestation that it holds this patient's consent, with the wording version and
      the moment it was given. Storing the booleans would say nothing — all six are mandatory, so
      the request could not have succeeded otherwise. What has to survive is the timestamp and the
      version. Optional so patients created before this shipped still load.
    */
    consent: {
      version: { type: String, required: false, default: '' },
      confirmedAt: { type: Date, required: false, default: null },
    },
    /*
      Consent state, denormalised from the `ConsentRecord` audit trail onto the record every send
      already loads.

      The audit collection is the evidence and the history; these two are the decision. A dispatch
      sweep carries hundreds of occurrences and cannot afford an audit query per row — it has this
      document in hand anyway to check email suppression, which is the same argument the delivery
      fields above are built on.

      Null means the consent stands. The date is when it was withdrawn, kept rather than reduced to
      a boolean because "since when" is the first thing a clinic asks when a patient says they
      stopped receiving reminders.

      `notificationsRevokedAt` halts every automated message: reminders, the daily summary, the
      portal link. It does not touch the clinical record behind them — under the Law of Georgia on
      Personal Data Protection a patient withdrawing consent to be messaged has not asked to be
      untreated. `portalAccessRevokedAt` closes the portal itself, which is a heavier thing and why
      it is separate.
    */
    notificationsRevokedAt: { type: Date, required: false, default: null },
    portalAccessRevokedAt: { type: Date, required: false, default: null },
    /*
      When an erasure request was applied to this record, and what could not be erased with it.

      Set by `applyErasureService`, which clears the contact and identity fields listed in
      `ERASABLE_PATIENT_FIELDS` and leaves the clinical log intact — the Law of Georgia on Health
      Care requires that log to be retained for a fixed period whatever the patient would prefer.
      The date is what lets a clinic tell an erased record from a badly entered one.
    */
    erasedAt: { type: Date, required: false, default: null },
    /*
      Email deliverability state for this patient's address.

      Held on the patient rather than in a lookup table because every send already loads this
      record, so the pre-send check costs nothing — and because the address itself lives here, so
      the two cannot drift apart when a clinic corrects a typo.

      `emailSuppressedAt` being null is the normal state. Suppression stops email only: push is a
      separate channel with its own delivery record, and a patient with a dead inbox must still
      get the notification that can wake their phone.
    */
    emailSuppressedAt: { type: Date, required: false, default: null },
    emailSuppressionReason: {
      type: String,
      enum: SUPPRESSION_REASONS,
      required: false,
      default: '',
    },
    /* Consecutive soft bounces. Any delivery resets it, so this measures a run, not a lifetime. */
    emailSoftBounces: { type: Number, required: false, default: 0 },
  },
  { timestamps: true }
);

PatientSchema.index({ clinicId: 1, lastName: 1 });

export type PatientDocument = InferSchemaType<typeof PatientSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PatientModel =
  mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
