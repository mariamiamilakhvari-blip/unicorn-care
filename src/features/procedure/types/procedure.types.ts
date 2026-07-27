/**
 * JSON-safe shape the procedure API returns to the browser: Mongo `ObjectId`s and `Date`s are
 * serialised to strings by `NextResponse.json`, so the client never sees a Mongoose type.
 */
export type ProcedureView = {
  _id: string;
  patientId: string;
  clinicId: string;
  performedAt: string;
  operatorName: string;
  operatorUserId: string | null;
  manipulationType: string;
  manipulationDetail: string;
  anesthesia: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ProcedureListView = {
  items: ProcedureView[];
  total: number;
};
