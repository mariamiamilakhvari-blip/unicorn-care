'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { ClinicProfileFields } from '@/features/clinic/components/clinic-profile-fields';
import { useRegisterClinic } from '@/features/clinic/hooks/use-register-clinic';
import {
  ClinicSignUpFormType,
  ClinicSignUpSchema,
  ClinicSignUpType,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/shared/const/routes.const';

/** Registers the owner account and the clinic in one submit, then signs the owner straight in. */
export function ClinicSignUpForm() {
  const t = useTranslations('clinic');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tConsent = useTranslations('consent');
  const { isPending, error, registerClinic } = useRegisterClinic();

  const form = useForm<ClinicSignUpFormType, undefined, ClinicSignUpType>({
    resolver: zodResolver(ClinicSignUpSchema),
    defaultValues: {
      email: '',
      password: '',
      clinicName: '',
      country: '',
      city: '',
      addressLine: '',
      clinicPhone: '',
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
      },
      locale: 'ka',
      timezone: 'Asia/Tbilisi',
    },
  });

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">{t('createClinic')}</CardTitle>
        <CardDescription>{t('createClinicHelp')}</CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(registerClinic)} className="flex flex-col gap-5">
            {/*
              Clinic name leads. It is the thing being registered, and asking for an email before
              naming the clinic reads as an account form that happens to mention clinics. Email and
              password then share a row rather than leaving half of one empty.
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="clinicName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tAuth('email')}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tAuth('password')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <ClinicProfileFields
              control={form.control}
              phoneField="clinicPhone"
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
              links={{ terms: TERMS_ROUTE, privacy: PRIVACY_ROUTE }}
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
