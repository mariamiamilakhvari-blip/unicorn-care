export type RecentPatient = {
  id: string;
  name: string;
};

export type ClinicOverview = {
  patientCount: number;
  recentPatients: RecentPatient[];
};
