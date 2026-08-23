'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect } from 'react';
import { Resolver, useForm } from 'react-hook-form';



import { ActivatePlanButton } from '@/features/care-plan/components/activate-plan-button';
import { CheckupFields } from '@/features/care-plan/components/checkup-fields';
import { MedicationFields } from '@/features/care-plan/components/medication-fields';
import { RecoveryLogToggle } from '@/features/care-plan/components/recovery-log-toggle';
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

/** Server codes that have copy of their own under `carePlan.error`. Anything else shows raw. */
const KNOWN_ERRORS = ['INVALID_CLINIC_TIMEZONE', 'INCOMPLETE_PLAN', 'SUBSCRIPTION_INACTIVE'];

type CarePlanBuilderProps = {
  procedureId: string;
  patientId: string;
  /** Drives the recovery guide section — the guide is written per procedure type. */
  manipulationType: string;
  patientLocale: AppLocale;
  /**
   * The zone a checkup's wall clock is read in, both ways. An appointment is a visit to the
   * clinic, booked on the clinic's calendar, so it is the clinic's zone and never the patient's.
   */
  clinicTimezone: string;
};

export function CarePlanBuilder({
  procedureId,
  patientId,
  manipulationType,
  patientLocale,
  clinicTimezone,
}: CarePlanBuilderProps) {
  const t = useTranslations('carePlan');
  const tCommon = useTranslations('common');
  const { plan, isLoading, isPending, error, save, activate } = useCarePlan(procedureId);

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
      recoveryLogEnabled: false,
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
    reset(toCarePlanFormValues(plan, clinicTimezone));
  }, [plan, reset, clinicTimezone]);

  /*
    Validates the plan and writes it, on behalf of the single Save at the foot of the page.

    The plan and the recovery guide are two forms posting to two endpoints, so "save everything"
    is a sequence rather than one request. This half runs first and reports whether it got
    through; the guide is only written if it did, so a rejected plan never leaves the two halves
    describing different things.

    `handleSubmit` is wrapped in a promise because it signals failure by calling a callback rather
    than by rejecting, and the caller needs a value to branch on. Wrapping it also keeps RHF's
    focus-first-error behaviour, which is what carries the clinician back up to an invalid field
    from a button that now sits far below it.
  */
  const savePlan = useCallback(
    () =>
      new Promise<boolean>(resolve => {
        void form.handleSubmit(
          async values => resolve(await save(procedureId, patientId, values)),
          () => resolve(false)
        )();
      }),
    [form, save, procedureId, patientId]
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  return (
    <Form {...form}>
      {/*
        This form has no submit button of its own — it is submitted through `savePlan` by the one
        Save at the foot of the guide section below. The handler exists only to swallow a submit
        that arrives anyway: a <form> whose event goes unhandled navigates, which would reload the
        page and discard everything typed into it. `noValidate` leaves the checking to the
        resolver, whose messages say more than the browser's bubble.
      */}
      <form noValidate onSubmit={event => event.preventDefault()} className="flex flex-col gap-6">
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

        <RecoveryLogToggle control={form.control} />

        <Separator />
        <MedicationFields control={form.control} />
        <Separator />
        <RehabTaskFields control={form.control} />
        <Separator />
        <CheckupFields control={form.control} />

      </form>

      {/*
        Outside the plan form on purpose — separate endpoint, and a nested form would submit both
        at once. The guide section carries the page's only Save, so the plan's own error copy and
        activation control are handed down to sit beside it rather than stranded up here, far from
        the button that produces them.
      */}
      <Separator className="my-6" />
      <CarePlanGuideSection
        manipulationType={manipulationType}
        locale={patientLocale}
        onSavePlan={savePlan}
        isPlanPending={isPending}
        /* Known error codes get a sentence the clinic can act on; anything else shows raw. */
        planError={error && (KNOWN_ERRORS.includes(error) ? t(`error.${error}`) : error)}
        planActions={
          /* Asks first when the patient has no way to receive anything the plan would send. */
          <>
            <ActivatePlanButton
              patientId={patientId}
              isDisabled={!plan || isPending}
              onActivate={activate}
            />
            {plan && (
              <span className="text-sm text-muted-foreground">{t(`status.${plan.status}`)}</span>
            )}
          </>
        }
      />
    </Form>
  );
}
