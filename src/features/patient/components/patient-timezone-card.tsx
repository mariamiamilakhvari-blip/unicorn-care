'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';

import { PatientTimezoneField } from '@/features/patient/components/patient-timezone-field';
import { usePatientTimezone } from '@/features/patient/hooks/use-patient-timezone';
import {
  PatientTimezoneEditFormType,
  PatientTimezoneEditSchema,
  PatientTimezoneEditType,
} from '@/features/patient/validations/patient.validation';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Form } from '@/shared/components/ui/form';
import { effectiveTimeZone } from '@/shared/const/timezone.const';

type PatientTimezoneCardProps = {
  patientId: string;
  /** The stored field, blank when the patient follows the clinic. */
  timezone: string;
  clinicTimezone: string;
};

/**
 * Where the clinic says the patient is, and what that means for their reminders.
 *
 * The portal already reports the patient's own device zone on every visit, so for most patients
 * this card only confirms what is already true. It exists for the patient who has not opened the
 * portal from where they now are — the one flying home for their second week, whose phone will
 * not tell us anything until they next look at their plan.
 *
 * Saving re-times the plan: the occurrence rows hold absolute instants, so the service drops the
 * pending ones and rebuilds them against the new zone. The line under the picker says so before
 * the click rather than after it.
 */
export function PatientTimezoneCard({
  patientId,
  timezone,
  clinicTimezone,
}: PatientTimezoneCardProps) {
  const t = useTranslations('patient');
  const { timezone: saved, save, isPending, savedAt, hasError } = usePatientTimezone(
    patientId,
    timezone
  );

  const form = useForm<PatientTimezoneEditFormType, undefined, PatientTimezoneEditType>({
    resolver: zodResolver(PatientTimezoneEditSchema),
    // `values`, not `defaultValues`: a save re-reads the stored zone off the response, and the
    // picker has to follow it rather than keep showing what was typed.
    values: { timezone: saved },
  });

  // `useWatch`, not `form.watch`: the latter hands back a fresh function every render, which the
  // React Compiler refuses to memoise around — and this value drives the line of copy below it.
  const selected = useWatch({ control: form.control, name: 'timezone' }) ?? '';
  const inForce = effectiveTimeZone(selected, clinicTimezone);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-4 text-primary" aria-hidden />
          {t('timezone')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(values => save(values.timezone))}
            className="flex flex-col gap-3"
          >
            <PatientTimezoneField
              control={form.control}
              name="timezone"
              clinicTimezone={clinicTimezone}
            />
            {/*
              The consequence, in the zone that will actually be in force — which is the clinic's
              own when the patient inherits, and so is not always the one the picker names.
            */}
            <p className="text-sm text-muted-foreground">
              {t('timezoneEffect', { zone: inForce.replace('_', ' ') })}
            </p>
            {hasError && (
              <p className="text-sm font-medium text-destructive">{t('timezoneSaveFailed')}</p>
            )}
            {savedAt !== null && !hasError && (
              <p className="text-sm font-medium text-moss">{t('timezoneSaved')}</p>
            )}
            <Button type="submit" disabled={isPending || selected === saved} className="self-start">
              {isPending ? t('timezoneSaving') : t('timezoneSubmit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
