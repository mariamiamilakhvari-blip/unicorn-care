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
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Form } from '@/shared/components/ui/form';

/** Shown to a signed-in account that has no clinic yet — the repair path, not a second signup. */
export function ClinicOnboardingForm() {
  const t = useTranslations('clinic');
  const tCommon = useTranslations('common');
  const { isPending, error, attachClinic } = useRegisterClinic();

  const form = useForm<ClinicOnlyFormType, undefined, ClinicOnlyType>({
    resolver: zodResolver(ClinicOnlySchema),
    defaultValues: {
      name: '',
      country: '',
      city: '',
      addressLine: '',
      phone: '',
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
              phoneField="phone"
              cityField="city"
              countryField="country"
              addressField="addressLine"
              timezoneField="timezone"
              localeField="locale"
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
