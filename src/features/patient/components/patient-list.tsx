'use client';

import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { AccessLinkDialog } from '@/features/patient/components/access-link-dialog';
import { PatientSummary } from '@/features/patient/types/patient.types';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';

type PatientListProps = {
  patients: PatientSummary[];
  onDelete: (id: string) => Promise<void>;
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

            {/* A full erasure. The dialog spells out what goes, because none of it comes back. */}
            <ConfirmDialog
              title={t('deleteTitle')}
              description={t('deleteWarning')}
              confirmLabel={t('delete')}
              onConfirm={() => onDelete(patient.id)}
              trigger={
                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="size-4" aria-hidden />
                  {t('delete')}
                </Button>
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
