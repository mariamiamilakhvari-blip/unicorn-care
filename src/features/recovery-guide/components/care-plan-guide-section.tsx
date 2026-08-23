'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ReactNode, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { ExpectedFields } from '@/features/recovery-guide/components/expected-fields';
import { WarningFields } from '@/features/recovery-guide/components/warning-fields';
import { useProcedureGuide } from '@/features/recovery-guide/hooks/use-procedure-guide';
import {
  RecoveryGuideFormType,
  UpsertRecoveryGuideSchema,
  UpsertRecoveryGuideType,
} from '@/features/recovery-guide/validations/recovery-guide.validation';
import { Button } from '@/shared/components/ui/button';
import { Form } from '@/shared/components/ui/form';
import { SectionTitle } from '@/shared/components/ui/section-title';
import { Separator } from '@/shared/components/ui/separator';
import { AppLocale } from '@/shared/types/roles';

/**
 * A stored item carries the window it applies over; the editor asks for its length. The start day
 * is dropped rather than shown, since there is nowhere left to put it — see `DurationDaysSchema`.
 */
function toFormItem<T extends { fromDay: number; toDay: number }>({
  fromDay,
  toDay,
  ...rest
}: T): Omit<T, 'fromDay' | 'toDay'> & { durationDays: number } {
  // `fromDay` is destructured to drop it, and read here so the intent is a statement rather than
  // an underscore: an item that started later loses that fact, because there is nowhere to put it.
  void fromDay;
  return { ...rest, durationDays: toDay };
}

type CarePlanGuideSectionProps = {
  manipulationType: string;
  /** The patient's language — the guide is written and shown in it. */
  locale: AppLocale;
  /**
   * Validates and writes the care plan half of the page. Resolves false when the plan is invalid
   * or its write was rejected, which is what stops the guide from being written on its own.
   */
  onSavePlan: () => Promise<boolean>;
  /** True while the plan half is in flight, so one Save reads as busy for both halves. */
  isPlanPending: boolean;
  /** The plan's error, already turned into copy by the builder, which owns those codes. */
  planError: string | null;
  /** Activation and plan status, supplied by the care plan and shown beside Save. */
  planActions: ReactNode;
};

/**
 * "What is normal / when to call" written inside the care plan, for the plan's own procedure type.
 *
 * Its own <form>, not part of the care plan form: the two save to different endpoints and a nested
 * form would submit both at once.
 *
 * It nonetheless carries the page's only Save. Two save buttons for what a clinician experiences
 * as one document meant a plan could be written while the guide beside it was left as a draft, and
 * neither button said which half it covered. The split survives in the markup, because the two
 * endpoints are real; it no longer survives in the interface.
 */
export function CarePlanGuideSection({
  manipulationType,
  locale,
  onSavePlan,
  isPlanPending,
  planError,
  planActions,
}: CarePlanGuideSectionProps) {
  const t = useTranslations('recoveryGuide');
  const tCarePlan = useTranslations('carePlan');
  const tCommon = useTranslations('common');
  const { guide, isLoading, isPending, savedAt, error, save } = useProcedureGuide(
    manipulationType,
    locale
  );

  const form = useForm<RecoveryGuideFormType, undefined, UpsertRecoveryGuideType>({
    resolver: zodResolver(UpsertRecoveryGuideSchema),
    defaultValues: {
      manipulationType,
      locale,
      expected: [],
      warning: [],
      isPublished: true,
    },
  });

  const { reset } = form;

  /*
    What the editor opens on: this clinic's own guide, or nothing at all.

    Nothing is pre-filled from a template, and the platform default is not loaded either. Both were
    tried and both were wrong for the same reason — a clinician opening a blank editor writes what
    they mean, and one opening a filled editor reads text somebody else wrote and presses save. The
    template is a deliberate act now, one click away on the button beside the heading.
  */
  useEffect(() => {
    if (guide && !guide.isDefault) {
      reset({
        manipulationType,
        locale,
        expected: guide.expected.map(toFormItem),
        warning: guide.warning.map(toFormItem),
        isPublished: guide.isPublished,
      });
      return;
    }

    reset({ manipulationType, locale, expected: [], warning: [], isPublished: true });
  }, [guide, manipulationType, locale, reset]);

  /*
    One click, both halves, in the only order that cannot half-write the page.

    React Hook Form has already validated the guide by the time this runs, and `onSavePlan`
    validates the plan before it writes anything — so an invalid half stops the flow with nothing
    sent, and the invalid field is focused wherever it sits.

    Two endpoints cannot be one transaction, so the plan is written first and the guide only
    follows if it landed. That ordering makes a failure recoverable by pressing the same button
    again: the plan write is idempotent for an existing plan, so a retry re-sends the plan and
    then reaches the guide. The reverse order would leave the guide — content shared by every
    patient with this procedure — updated to describe a plan the server had rejected.
  */
  const saveAll = useCallback(
    async (values: UpsertRecoveryGuideType) => {
      if (!(await onSavePlan())) return;
      await save(values);
    },
    [onSavePlan, save]
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  // One button spanning two requests: it stays busy until the slower half is done.
  const isBusy = isPending || isPlanPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(saveAll)} className="flex flex-col gap-5">
        <SectionTitle>{t('title')}</SectionTitle>

        <ExpectedFields control={form.control} />
        <Separator />
        <WarningFields control={form.control} locale={locale} />

        {/* Whichever half failed, reported in the one place the clinic pressed. */}
        {(planError || error) && (
          <p className="text-sm font-medium text-destructive">{planError ?? error}</p>
        )}

        {/*
          The page's actions, at the foot of everything they act on: the plan's fields, then the
          expected signs, then the warning signs. Save writes all of it; activation follows,
          because there is no point publishing a plan to the patient's portal before it is stored.
        */}
        <Separator />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isBusy}>
            {isBusy ? tCommon('loading') : tCommon('save')}
          </Button>
          {planActions}
          {/*
            The guide is written last, so its timestamp is the one thing that means both halves
            landed — a silent 200 on either was why saving used to look broken.
          */}
          {savedAt && !error && !planError && (
            <span className="flex items-center gap-2 text-sm font-medium text-moss">
              <Check className="size-4" aria-hidden />
              {tCarePlan('planSaved')}
            </span>
          )}
        </div>
      </form>
    </Form>
  );
}
