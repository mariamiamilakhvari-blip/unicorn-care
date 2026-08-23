import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ProcedureSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    performedAt: { type: Date, required: true },
    operatorName: { type: String, required: true },
    operatorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    // Stable key from PROCEDURE_TYPES in src/shared/const/procedure.const.ts — label is translated at render time.
    manipulationType: { type: String, required: true },
    manipulationDetail: { type: String, required: false, default: '' },
    anesthesia: {
      type: String,
      enum: ['none', 'local', 'sedation', 'general'],
      default: 'local',
      required: true,
    },
    notes: { type: String, required: false, default: '' },
    /*
      How many minutes before a reminder for this procedure should go out. Recorded at intake so
      the clinic's intent is captured with the rest of the procedure.

      Nothing reads it yet: reminders are generated from care plan items — medications, rehab
      tasks, checkups and the recovery log — and a procedure is a record of something that already
      happened, so no occurrence is scheduled from `performedAt`. 0 is the honest default.
    */
    remindMinutesBefore: { type: Number, default: 0, required: true },
  },
  { timestamps: true }
);

ProcedureSchema.index({ clinicId: 1, patientId: 1, performedAt: -1 });

export type ProcedureDocument = InferSchemaType<typeof ProcedureSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProcedureModel =
  mongoose.models.Procedure || mongoose.model('Procedure', ProcedureSchema);
