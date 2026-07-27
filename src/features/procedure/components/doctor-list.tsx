'use client';

import { KeyRound, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';

import { useDoctors } from '@/features/procedure/hooks/use-doctors';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';

/**
 * Built from the operating surgeon recorded on each procedure, so it is always in step with the
 * clinical record. There is nothing to add or remove here — logging a procedure is what puts a
 * doctor on this list.
 */
export function DoctorList() {
  const t = useTranslations('clinic');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const locale = useLocale();
  const { doctors, isLoading, error } = useDoctors();

  function labelFor(key: string): string {
    const match = PROCEDURE_TYPES.find(type => type.key === key);
    if (!match) return key;
    return locale === 'ka' ? match.ka : match.en;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="size-4 text-primary" aria-hidden />
          {t('doctors')}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {!isLoading && doctors.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noDoctorsYet')}</p>
        )}

        {doctors.length > 0 && (
          <ul className="flex flex-col gap-3">
            {doctors.map(doctor => (
              <li key={doctor.name} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{doctor.name}</p>
                  {doctor.jobTitle && (
                    <span className="text-sm text-muted-foreground">{doctor.jobTitle}</span>
                  )}
                  {doctor.hasAccount && (
                    <Badge variant="secondary" className="gap-1">
                      <KeyRound className="size-3" aria-hidden />
                      {t('hasLogin')}
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {doctor.manipulationTypes.map(labelFor).join(' · ')}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {t('procedureCount', { count: doctor.procedureCount })} ·{' '}
                  {t('lastOperated', {
                    date: format.dateTime(new Date(doctor.lastPerformedAt), {
                      dateStyle: 'medium',
                    }),
                  })}
                </p>

                {doctor.patients.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {doctor.patients.map(patient => (
                      <li key={patient.id}>
                        <Link
                          href={`/dashboard/patients/${patient.id}`}
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          {patient.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
