'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useSubscription } from '@/features/clinic/hooks/use-subscription';
import { PatientForm } from '@/features/patient/components/patient-form';
import { PatientList } from '@/features/patient/components/patient-list';
import { PatientSeatNotice } from '@/features/patient/components/patient-seat-notice';
import {
  PatientWriteError,
  PatientWriteErrorNotice,
  toPatientWriteError,
} from '@/features/patient/components/patient-write-error';
import { usePatients } from '@/features/patient/hooks/use-patients';
import { CreatePatientType } from '@/features/patient/validations/patient.validation';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { useDebounce } from '@/shared/hooks/use-debounce';

export function PatientsPage() {
  const t = useTranslations('patient');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { patients, isLoading, hasError, create, archive } = usePatients(debouncedSearch || undefined);
  const { subscription } = useSubscription();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [writeError, setWriteError] = useState<PatientWriteError | null>(null);

  /*
    A refused write is an answer, not a crash. Without this catch the rejection escaped to the
    error overlay and the clinic saw `SUBSCRIPTION_INACTIVE` as a stack trace, with the form
    contents lost and nothing to click. The form stays open so the typed details survive.
  */
  async function handleCreate(values: CreatePatientType) {
    setIsPending(true);
    setWriteError(null);
    try {
      await create(values);
      setIsFormOpen(false);
    } catch (caught) {
      setWriteError(toPatientWriteError(caught));
    } finally {
      setIsPending(false);
    }
  }

  /*
    Blocked until the subscription says otherwise — but only once it has answered. Disabling the
    button while the subscription is still loading would flicker it off on every visit, and a
    clinic that clicks in that window is refused by the service anyway.
  */
  const canAddPatient = !subscription || (subscription.canWrite && !subscription.isAtPatientLimit);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">{t('plural')}</h1>
        <Button
          onClick={() => setIsFormOpen(open => !open)}
          disabled={!canAddPatient && !isFormOpen}
        >
          {isFormOpen ? tCommon('cancel') : t('createPatient')}
        </Button>
      </div>

      {/* The wall before the form, so an intake is never typed out only to be refused. */}
      {subscription && <PatientSeatNotice subscription={subscription} />}

      {writeError && (
        <PatientWriteErrorNotice error={writeError} patientLimit={subscription?.patientLimit} />
      )}

      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('createPatient')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PatientForm onSubmit={handleCreate} isPending={isPending} />
          </CardContent>
        </Card>
      )}

      <Input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={tCommon('search')}
        className="max-w-sm"
      />

      {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}
      {hasError && <p className="text-sm font-medium text-destructive">{tCommon('error')}</p>}
      {!isLoading && !hasError && <PatientList patients={patients} onArchive={archive} />}
    </div>
  );
}
