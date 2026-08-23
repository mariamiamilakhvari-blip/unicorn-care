'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { PatientIdentityFields } from '@/features/patient/components/patient-identity-fields';
import {
  CreatePatientFormType,
  CreatePatientSchema,
  CreatePatientType,
  PATIENT_CONSENT_KEYS,
} from '@/features/patient/validations/patient.validation';
import { ConsentChecklist } from '@/shared/components/consent-checklist';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Textarea } from '@/shared/components/ui/textarea';

type PatientFormProps = {
  onSubmit: (values: CreatePatientType) => Promise<void>;
  isPending: boolean;
};

export function PatientForm({ onSubmit, isPending }: PatientFormProps) {
  const t = useTranslations('patient');
  const tConsent = useTranslations('consent');

  const form = useForm<CreatePatientFormType, undefined, CreatePatientType>({
    resolver: zodResolver(CreatePatientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      dateOfBirth: null,
      sex: 'unspecified',
      locale: 'ka',
      allergies: [],
      notes: '',
      consents: {
        personalData: false,
        healthData: false,
        reminders: false,
        informed: false,
        accurate: false,
        corrections: false,
      },
    },
  });

  async function handleSubmit(values: CreatePatientType) {
    await onSubmit(values);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <PatientIdentityFields control={form.control} />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notes')}</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/*
          Immediately above the submit button, because this is the point where the clinic takes
          responsibility for a real person's health data — not something to scroll past.
        */}
        <ConsentChecklist
          control={form.control}
          namespace="consent.patient"
          heading={tConsent('patientHeading')}
          fields={PATIENT_CONSENT_KEYS.map(key => `consents.${key}` as const)}
        />

        <Button type="submit" disabled={isPending} className="self-start">
          {t('createPatient')}
        </Button>
      </form>
    </Form>
  );
}
