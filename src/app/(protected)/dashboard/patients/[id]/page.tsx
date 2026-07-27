import { notFound } from 'next/navigation';

import { PatientDetail } from '@/features/patient/components/patient-detail';
import { getPatientService } from '@/features/patient/service/patient.service';
import { PatientSummary } from '@/features/patient/types/patient.types';
import { clinicGuard } from '@/shared/lib/clinic-guard';

type PageProps = { params: Promise<{ id: string }> };

export default async function PatientDetailPage({ params }: PageProps) {
  const session = await clinicGuard.requireClinicUser();
  if (!session) notFound();

  const { id } = await params;
  const { data, status } = await getPatientService(session.clinicId, id);
  if (status !== 200) notFound();

  const patient = data as PatientSummary;

  return (
    <PatientDetail
      patientId={patient.id}
      patientName={`${patient.firstName} ${patient.lastName}`}
      patientLocale={patient.locale}
    />
  );
}
