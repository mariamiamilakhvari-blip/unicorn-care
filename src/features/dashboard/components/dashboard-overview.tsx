import { ArrowRight, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { ClinicOverview } from '@/features/dashboard/types/dashboard.types';
import { SymptomReportQueue } from '@/features/recovery-guide/components/symptom-report-queue';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type DashboardOverviewProps = {
  userName: string;
  overview: ClinicOverview;
};

export const DashboardOverview = ({ userName, overview }: DashboardOverviewProps) => {
  const t = useTranslations('dashboard');
  const tPatient = useTranslations('patient');

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {t('overview')}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t('welcome', { name: userName })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild className="w-full font-semibold sm:w-auto">
          <Link href="/dashboard/patients">
            {tPatient('createPatient')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </header>

      <SymptomReportQueue />

      <section className="animate-rise animate-rise-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tPatient('plural')}
            </CardTitle>
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Users className="size-4" aria-hidden />
            </span>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold tracking-tight sm:text-3xl">
              {overview.patientCount}
            </span>
          </CardContent>
        </Card>
      </section>

      <Card className="animate-rise animate-rise-2">
        <CardHeader>
          <CardTitle className="text-base">{t('recentPatients')}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.recentPatients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tPatient('empty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {overview.recentPatients.map(patient => (
                <li key={patient.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="truncate text-sm font-medium">{patient.name}</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/patients/${patient.id}`}>{tPatient('title')}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
