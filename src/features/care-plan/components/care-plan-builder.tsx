'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Resolver, useForm } from 'react-hook-form';



import { CheckupFields } from '@/features/care-plan/components/checkup-fields';
import { MedicationFields } from '@/features/care-plan/components/medication-fields';
import { RehabTaskFields } from '@/features/care-plan/components/rehab-task-fields';
import { useCarePlan } from '@/features/care-plan/hooks/use-care-plan';
import { CarePlanFormType } from '@/features/care-plan/types/care-plan-form.types';
import { toCarePlanFormValues } from '@/features/care-plan/types/care-plan-mapper';
import { CarePlanFormSchema } from '@/features/care-plan/validations/care-plan-form.validation';
import {
  isUntouchedCheckupRow,
  isUntouchedMedicationRow,
  isUntouchedRehabRow,
} from '@/features/care-plan/validations/care-plan.validation';
import { CarePlanGuideSection } from '@/features/recovery-guide/components/care-plan-guide-section';
import { Button } from '@/shared/components/ui/button';
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
import { AppLocale } from '@/shared/types/roles';

type CarePlanBuilderProps = {
  procedureId: string;
  patientId: string;
  /** Drives the recovery guide section — the guide is written per procedure type. */
  manipulationType: string;
  patientLocale: AppLocale;
};

export function CarePlanBuilder({
  procedureId,
  patientId,
  manipulationType,
  patientLocale,
}: CarePlanBuilderProps) {
  const t = useTranslations('carePlan');
  const tCommon = useTranslations('common');
  const { plan, isLoading, isPending, error, savedAt, save, activate } = useCarePlan(procedureId);

  /*
    Blank blocks are filtered out before the schema sees them, in all three sections.

    Each "add" button appends an empty block, and all three sections are optional — a clinician
    who adds one and changes their mind was left with a plan that could not be saved and a column
    of red `Required` labels that explained nothing. The predicates come from the API schema, so
    the form and the endpoint cannot disagree about what counts as blank.

    Filtering here rather than inside the form schema keeps the resolver typed against the form's
    own shape: `z.preprocess` widens its input to `unknown` and breaks that contract.

    Only entirely untouched rows go. A row with a name and no dates is interrupted work, not a
    mistake to erase, and it still fails — the clinician finishes it or deletes it.
  */
  const resolver: Resolver<CarePlanFormType> = (values, context, options) =>
    zodResolver(CarePlanFormSchema)(
      {
        ...values,
        medications: values.medications.filter(row => !isUntouchedMedicationRow(row)),
        rehabTasks: values.rehabTasks.filter(row => !isUntouchedRehabRow(row)),
        checkups: values.checkups.filter(row => !isUntouchedCheckupRow(row)),
      },
      context,
      options
    );

  // Without a resolver nothing was checked until the server rejected the whole payload, and the
  // only feedback was a bare VALIDATION_ERROR with no indication of which field was wrong.
  const form = useForm<CarePlanFormType>({
    resolver,
    mode: 'onBlur',
    defaultValues: {
      startsAt: '',
      rehabEndsAt: '',
      medications: [],
      rehabTasks: [],
      checkups: [],
    },
  });

  const { reset } = form;

  // Repopulates the form once the stored plan arrives, so reopening a patient shows the saved
  // plan rather than an empty builder.
  useEffect(() => {
    if (!plan) return;
    reset(toCarePlanFormValues(plan));
  }, [plan, reset]);

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(values => save(procedureId, patientId, values))}
        className="flex flex-col gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('startsOn')}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    onChange={event => {
                      field.onChange(event);
                      // Window errors are reported on rehabEndsAt and on each item, so widening
                      // the plan has to clear them rather than leave save blocked.
                      void form.trigger(['rehabEndsAt', 'medications', 'rehabTasks', 'checkups']);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rehabEndsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('rehabEndsAt')}</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    onChange={event => {
                      field.onChange(event);
                      void form.trigger(['rehabEndsAt', 'medications', 'rehabTasks', 'checkups']);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />
        <MedicationFields control={form.control} />
        <Separator />
        <RehabTaskFields control={form.control} />
        <Separator />
        <CheckupFields control={form.control} />

        {/* Known error codes get a sentence the clinic can act on; anything else shows raw. */}
        {error && (
          <p className="text-sm font-medium text-destructive">
            {error === 'INVALID_CLINIC_TIMEZONE' || error === 'INCOMPLETE_PLAN'
              ? t(`error.${error}`)
              : error}
          </p>
        )}

        {/*
          A silent 200 is why this looked broken: the request succeeded, nothing on screen changed,
          and the reasonable conclusion was that saving had failed.
        */}
        {savedAt && !error && !form.formState.isDirty && (
          <p className="flex items-center gap-2 text-sm font-medium text-moss">
            <Check className="size-4" aria-hidden />
            {t('planSaved')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon('loading') : tCommon('save')}
          </Button>
          {/* Activation is the moment reminders start existing, so it is a separate deliberate act. */}
          <Button type="button" variant="outline" disabled={!plan || isPending} onClick={() => void activate()}>
            {t('activatePlan')}
          </Button>
          {plan && <span className="text-sm text-muted-foreground">{t(`status.${plan.status}`)}</span>}
        </div>
      </form>

      {/* Outside the plan form on purpose — separate endpoint, separate save. */}
      <Separator className="my-6" />
      <CarePlanGuideSection manipulationType={manipulationType} locale={patientLocale} />
    </Form>
  );
}
