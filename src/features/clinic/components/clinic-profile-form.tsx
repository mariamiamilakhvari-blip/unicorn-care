'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { ClinicProfileFields } from '@/features/clinic/components/clinic-profile-fields';
import { ClinicProfile } from '@/features/clinic/types/clinic.types';
import {
  ClinicProfileFormType,
  ClinicProfileSchema,
  ClinicProfileType,
} from '@/features/clinic/validations/clinic.validation';
import { Button } from '@/shared/components/ui/button';
import { Form } from '@/shared/components/ui/form';
import { DEFAULT_TIMEZONE } from '@/shared/const/timezone.const';

type ClinicProfileFormProps = {
  clinic: ClinicProfile;
  onSubmit: (values: ClinicProfileType) => Promise<void>;
  isPending: boolean;
  savedAt: number | null;
};

/**
 * Editing the clinic record. The timezone in particular has to be changeable here: it drives every
 * prescribed time, and a clinic that saved an invalid one otherwise has no way to repair itself.
 */
export function ClinicProfileForm({
  clinic,
  onSubmit,
  isPending,
  savedAt,
}: ClinicProfileFormProps) {
  const t = useTranslations('clinic');
  const tCommon = useTranslations('common');

  const form = useForm<ClinicProfileFormType, undefined, ClinicProfileType>({
    resolver: zodResolver(ClinicProfileSchema),
    defaultValues: {
      name: clinic.name,
      country: clinic.country,
      city: clinic.city,
      addressLine: clinic.addressLine,
      phone: clinic.phone,
      locale: clinic.locale,
      // An existing invalid value cannot be shown in the picker, so fall back to the default and
      // let the clinic confirm a real one.
      timezone: clinic.timezone || DEFAULT_TIMEZONE,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
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

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? tCommon('loading') : tCommon('save')}
          </Button>
          {savedAt && (
            <span className="flex items-center gap-2 text-sm font-medium text-moss">
              <Check className="size-4" aria-hidden />
              {t('clinicSaved')}
            </span>
          )}
        </div>
      </form>
    </Form>
  );
}
