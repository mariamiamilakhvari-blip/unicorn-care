import { notFound } from 'next/navigation';

import { getClinicService } from '@/features/clinic/service/clinic.service';
import { ClinicProfile } from '@/features/clinic/types/clinic.types';
import { PatientsPage } from '@/features/patient/components/patients-page';
import { DEFAULT_TIMEZONE } from '@/shared/const/timezone.const';
import { clinicGuard } from '@/shared/lib/clinic-guard';

/*
  The clinic's zone is read here rather than fetched by the form, because it is the default answer
  to a question the form asks before anything has loaded — a picker that starts on "follow the
  clinic" without being able to say which zone that is tells the clinic nothing.
*/
export default async function DashboardPatientsPage() {
  const session = await clinicGuard.requireClinicUser();
  if (!session) notFound();

  const { data, status } = await getClinicService(session.clinicId);
  const clinic = status === 200 ? (data as ClinicProfile) : null;

  return <PatientsPage clinicTimezone={clinic?.timezone || DEFAULT_TIMEZONE} />;
}
