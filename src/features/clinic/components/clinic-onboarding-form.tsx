'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { ClinicProfileFields } from '@/features/clinic/components/clinic-profile-fields';
import { useRegisterClinic } from '@/features/clinic/hooks/use-register-clinic';
import {
  ClinicOnlyFormType,
  ClinicOnlySchema,
  ClinicOnlyType,
} from '@/features/clinic/validations/clinic-signup.validation';
import { CLINIC_CONSENT_KEYS } from '@/features/clinic/validations/clinic.validation';
import { ConsentChecklist } from '@/shared/components/consent-checklist';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Form } from '@/shared/components/ui/form';
import { DPA_ROUTE, PRIVACY_ROUTE, TERMS_ROUTE } from '@/shared/const/routes.const';

/** Shown to a signed-in account that has no clinic yet — the repair path, not a second signup. */
export function ClinicOnboardingForm() {
  const t = useTranslations('clinic');
  const tCommon = useTranslations('common');
  const tConsent = useTranslations('consent');
  const { isPending, error, attachClinic } = useRegisterClinic();

  const form = useForm<ClinicOnlyFormType, undefined, ClinicOnlyType>({
    resolver: zodResolver(ClinicOnlySchema),
    defaultValues: {
      name: '',
      brandName: '',
      country: '',
      city: '',
      addressLine: '',
      phone: '',
      email: '',
      taxId: '',
      consents: {
        terms: false,
        privacy: false,
        patientConsents: false,
        accuracy: false,
        credentials: false,
        processingPurpose: false,
        remindersNotMedicalAdvice: false,
        regulatoryCompliance: false,
        dataProcessing: false,
      },
      locale: 'ka',
      timezone: 'Asia/Tbilisi',
    },
  });

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">{t('createClinic')}</CardTitle>
        <CardDescription>{t('onboardingHelp')}</CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(attachClinic)} className="flex flex-col gap-5">
            <ClinicProfileFields
              control={form.control}
              nameField="name"
              legalNameField="name"
              brandNameField="brandName"
              phoneField="phone"
              emailField="email"
              cityField="city"
              countryField="country"
              addressField="addressLine"
              taxIdField="taxId"
              timezoneField="timezone"
              localeField="locale"
            />


            {/*
              Consent sits directly above the submit button on purpose: it is the last thing read
              before the clinic commits, and burying it mid-form invites scrolling past it.
            */}
            <ConsentChecklist
              control={form.control}
              namespace="consent.clinic"
              heading={tConsent('clinicHeading')}
              fields={CLINIC_CONSENT_KEYS.map(key => `consents.${key}` as const)}
              links={{ terms: TERMS_ROUTE, privacy: PRIVACY_ROUTE, dataProcessing: DPA_ROUTE }}
            />

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? tCommon('loading') : t('createClinic')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
