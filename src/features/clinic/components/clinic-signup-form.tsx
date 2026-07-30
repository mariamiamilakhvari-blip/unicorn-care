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

/** Registers the owner account and the clinic in one submit, then signs the owner straight in. */
export function ClinicSignUpForm() {
  const t = useTranslations('clinic');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const { isPending, error, registerClinic } = useRegisterClinic();

  const form = useForm<ClinicSignUpFormType, undefined, ClinicSignUpType>({
    resolver: zodResolver(ClinicSignUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      clinicName: '',
      country: '',
      city: '',
      addressLine: '',
      clinicPhone: '',
      taxId: '',
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tAuth('name')}</FormLabel>
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
                  <FormItem className="sm:col-span-2">
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
              nameField="clinicName"
              phoneField="clinicPhone"
              cityField="city"
              countryField="country"
              addressField="addressLine"
              taxIdField="taxId"
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
