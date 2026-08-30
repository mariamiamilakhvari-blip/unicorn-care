'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { AccessLinkDialog } from '@/features/patient/components/access-link-dialog';
import { DeletePatientDialog } from '@/features/patient/components/delete-patient-dialog';
import { PatientSummary } from '@/features/patient/types/patient.types';
import { Button } from '@/shared/components/ui/button';

type PatientListProps = {
  patients: PatientSummary[];
  onDelete: (id: string, confirmationName: string) => Promise<void>;
};

export function PatientList({ patients, onDelete }: PatientListProps) {
  const t = useTranslations('patient');
  const tCommon = useTranslations('common');

  if (patients.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {patients.map(patient => (
        <li
          key={patient.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {patient.firstName} {patient.lastName}
            </p>
            {/*
              `!== null` rather than a truthy test: an age of 0 is a real patient, and a falsy
              check would hide the row's age for the group it matters most for.
            */}
            {patient.age !== null && (
              <p className="text-sm text-muted-foreground">
                {t('ageValue', { age: patient.age })}
              </p>
            )}
            {patient.phone && (
              <p className="truncate text-sm text-muted-foreground">{patient.phone}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <AccessLinkDialog patientId={patient.id} />
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/patients/${patient.id}`}>
                <Pencil className="size-4" aria-hidden />
                {tCommon('edit')}
              </Link>
            </Button>

            {/*
              A full erasure behind a typed confirmation. None of it comes back, so a single
              click is not a strong enough gate — see `DeletePatientDialog`.
            */}
            <DeletePatientDialog
              patientId={patient.id}
              patientName={`${patient.firstName} ${patient.lastName}`.trim()}
              onDelete={onDelete}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
