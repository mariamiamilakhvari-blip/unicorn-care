'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PatientForm } from '@/features/patient/components/patient-form';
import { PatientList } from '@/features/patient/components/patient-list';
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleCreate(values: CreatePatientType) {
    setIsPending(true);
    try {
      await create(values);
      setIsFormOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">{t('plural')}</h1>
        <Button onClick={() => setIsFormOpen(open => !open)}>
          {isFormOpen ? tCommon('cancel') : t('createPatient')}
        </Button>
      </div>

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
