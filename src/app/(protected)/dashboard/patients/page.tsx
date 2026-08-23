import { notFound } from 'next/navigation';

import { PatientsPage } from '@/features/patient/components/patients-page';
import { clinicGuard } from '@/shared/lib/clinic-guard';

export default async function DashboardPatientsPage() {
  const session = await clinicGuard.requireClinicUser();
  if (!session) notFound();

  return <PatientsPage />;
}
