'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { ClinicProfileForm } from '@/features/clinic/components/clinic-profile-form';
import { DeleteClinicCard } from '@/features/clinic/components/delete-clinic-card';
import { SubscriptionCard } from '@/features/clinic/components/subscription-card';
import { useClinic } from '@/features/clinic/hooks/use-clinic';
import {
  CreateStaffSchema,
  CreateStaffType,
} from '@/features/clinic/validations/clinic.validation';
import { DataRequestQueue } from '@/features/data-protection/components/data-request-queue';
import { DoctorList } from '@/features/procedure/components/doctor-list';
import { ClinicRatingsPanel } from '@/features/rating/components/clinic-ratings-panel';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { isValidTimeZone } from '@/shared/const/timezone.const';

export function ClinicPage() {
  const t = useTranslations('clinic');
  const tCommon = useTranslations('common');
  const { clinic, invite, isLoading, isPending, savedAt, error, createStaff, updateClinic } =
    useClinic();

  const form = useForm<CreateStaffType>({
    resolver: zodResolver(CreateStaffSchema),
    defaultValues: { name: '', email: '', jobTitle: '' },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  const hasBadTimezone = clinic ? !isValidTimeZone(clinic.timezone) : false;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>

      {/* Surfaced here because the symptom shows up somewhere else entirely — plan activation. */}
      {hasBadTimezone && (
        <p className="flex items-start gap-2 rounded-md border border-destructive p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {t('badTimezoneWarning')}
        </p>
      )}

      {clinic && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('profile')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ClinicProfileForm
              clinic={clinic}
              onSubmit={updateClinic}
              isPending={isPending}
              savedAt={savedAt}
            />
          </CardContent>
        </Card>
      )}

      {/* Renders nothing while the queue is empty. High on the page when it is not: these carry a
          statutory deadline, and a card the clinic has to scroll to find is one it answers late. */}
      <DataRequestQueue />

      <SubscriptionCard />

      {/* Derived from procedures — appears without anyone maintaining it. */}
      <DoctorList />

      {/* Beside the doctors, because that is what the scores are about. */}
      <ClinicRatingsPanel />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('addDoctor')}</CardTitle>
          {/* Says what this actually does: it creates a login, not a roster entry. */}
          <p className="text-sm text-muted-foreground">{t('addDoctorHelp')}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(values => createStaff(values))}
              className="grid items-end gap-4 sm:grid-cols-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('doctorName')}</FormLabel>
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('specialty')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">{t('addDoctor')}</Button>
            </form>
          </Form>

          {/* Shown once — there is no email channel to resend a temporary password on. */}
          {invite && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{invite.email}</p>
              <p className="font-mono text-muted-foreground">{invite.temporaryPassword}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('passwordShownOnce')}</p>
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Last on the page: destructive actions belong below everything a clinic uses day to day. */}
      {clinic && <DeleteClinicCard clinicName={clinic.name} />}
    </div>
  );
}
