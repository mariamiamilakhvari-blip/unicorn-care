export type RecentPatient = {
  id: string;
  name: string;
};

/** A patient in active care whom no reminder can reach. */
export type UnreachablePatient = RecentPatient & {
  /** Why, so the banner can send the clinic to the right remedy. */
  reason: 'NO_CONTACT_METHOD' | 'EMAIL_SUPPRESSED';
};

export type ClinicOverview = {
  patientCount: number;
  recentPatients: RecentPatient[];
  /**
   * Patients whose reminders reach nobody.
   *
   * On the dashboard because the warnings on the patient page and at plan activation only fire
   * when somebody happens to be looking at that patient. These are the ones nobody is looking
   * at — a plan running for months, every reminder marked handled, and the patient never told.
   */
  unreachable: UnreachablePatient[];
};
