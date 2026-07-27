'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { CarePlanBuilder } from '@/features/care-plan/components/care-plan-builder';
import { AccessLinkDialog } from '@/features/patient/components/access-link-dialog';
import { ProcedureForm } from '@/features/procedure/components/procedure-form';
import { ProcedureRow } from '@/features/procedure/components/procedure-row';
import { useProcedures } from '@/features/procedure/hooks/use-procedures';
import { CreateProcedureType } from '@/features/procedure/validations/procedure.validation';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { AppLocale } from '@/shared/types/roles';

type PatientDetailProps = {
  patientId: string;
  patientName: string;
  /** The guide is written in the patient's language, so it has to come from the record. */
  patientLocale: AppLocale;
};

export function PatientDetail({ patientId, patientName, patientLocale }: PatientDetailProps) {
  const t = useTranslations('procedure');
  const tCarePlan = useTranslations('carePlan');
  const tCommon = useTranslations('common');

  const { procedures, isLoading, error, create, update, remove } = useProcedures(patientId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const editing = procedures.find(procedure => procedure._id === editingId) ?? null;
  const selectedProcedure = procedures.find(procedure => procedure._id === selectedId) ?? null;

  // Select the most recent procedure once they load, so the care plan is one click away rather
  // than hidden until something new is created.
  useEffect(() => {
    if (selectedId || procedures.length === 0) return;
    setSelectedId(procedures[0]._id);
  }, [procedures, selectedId]);

  async function handleCreate(values: CreateProcedureType) {
    setIsPending(true);
    try {
      const created = await create(values);
      if (created) {
        setSelectedId(created._id);
        setIsFormOpen(false);
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleUpdate(values: CreateProcedureType) {
    if (!editingId) return;
    setIsPending(true);
    try {
      const updated = await update(editingId, values);
      if (updated) setEditingId(null);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    const removed = await remove(id);
    if (!removed) return;
    // Clear any selection pointing at the row that no longer exists.
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">{patientName}</h1>
        <AccessLinkDialog patientId={patientId} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('plural')}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setIsFormOpen(open => !open)}>
            {isFormOpen ? tCommon('cancel') : t('createProcedure')}
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          {!isLoading && procedures.length === 0 && !isFormOpen && (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          )}

          {procedures.length > 0 && (
            <ul className="flex flex-col gap-2">
              {procedures.map(procedure => (
                <ProcedureRow
                  key={procedure._id}
                  procedure={procedure}
                  isSelected={procedure._id === selectedId}
                  onSelect={() => setSelectedId(procedure._id)}
                  onEdit={() => setEditingId(procedure._id)}
                  onDelete={() => handleDelete(procedure._id)}
                />
              ))}
            </ul>
          )}

          {editing && (
            <div className="flex flex-col gap-3 rounded-lg border border-primary-edge p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('editProcedure')}</p>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  {tCommon('cancel')}
                </Button>
              </div>
              <ProcedureForm
                key={editing._id}
                patientId={patientId}
                procedure={editing}
                onSubmit={handleUpdate}
                isPending={isPending}
              />
            </div>
          )}

          {isFormOpen && (
            <ProcedureForm patientId={patientId} onSubmit={handleCreate} isPending={isPending} />
          )}
        </CardContent>
      </Card>

      {/* The care plan hangs off a procedure, so the builder only appears once one is selected. */}
      {selectedId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tCarePlan('title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CarePlanBuilder
              key={selectedId}
              procedureId={selectedId}
              patientId={patientId}
              manipulationType={selectedProcedure?.manipulationType ?? ''}
              patientLocale={patientLocale}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
