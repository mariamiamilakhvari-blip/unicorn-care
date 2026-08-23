'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Info, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect } from 'react';
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
import { Separator } from '@/shared/components/ui/separator';
import { recoveryGuideTemplate } from '@/shared/const/recovery-guide-template.const';
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
};

/**
 * "What is normal / when to call" written inside the care plan, for the plan's own procedure type.
 *
 * Its own <form>, not part of the care plan form: the two save to different endpoints and a nested
 * form would submit both at once.
 */
export function CarePlanGuideSection({ manipulationType, locale }: CarePlanGuideSectionProps) {
  const t = useTranslations('recoveryGuide');
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
    Fills the form and stops. Nothing is saved and nothing is published — a template is a starting
    point for the clinician reading it, not content this product is willing to put in front of a
    post-operative patient on its own authority.

    The template's day windows are collapsed to their length, because that is what the editor now
    asks for. An item the draft scheduled from day 14 becomes "for 365 days" here and will store as
    0–365 if saved: one field cannot carry two numbers, and the number a clinic is answering for is
    how long.
  */
  const applyTemplate = useCallback(() => {
    const template = recoveryGuideTemplate(locale, manipulationType);
    reset({
      manipulationType,
      locale,
      expected: template.expected.map(toFormItem),
      warning: template.warning.map(toFormItem),
      isPublished: false,
    });
  }, [locale, manipulationType, reset]);

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

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(save)} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">{t('title')}</h2>
            <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {/* Says plainly that this is shared content, so nobody edits it thinking it is
                  specific to the patient in front of them. */}
              {guide?.isDefault ? t('usingDefault') : t('sharedAcrossPatients')}
            </p>
          </div>

          {/*
            One click, and no confirmation, because the click is not the destructive act — it
            refills the form and nothing else. What is stored changes when the clinic presses save,
            which is the same deliberate step every other edit on this screen goes through, and
            leaving without saving still leaves the stored guide exactly as it was.

            It exists for legacy content: a clinic guide written years ago, or the incorrect line
            somebody typed once, needs a way back to the reviewed template that is not deleting
            rows by hand.
          */}
          <Button type="button" variant="ghost" size="sm" onClick={applyTemplate}>
            <RotateCcw className="size-4" aria-hidden />
            {t('resetToTemplate')}
          </Button>
        </div>

        <ExpectedFields control={form.control} />
        <Separator />
        <WarningFields control={form.control} locale={locale} />

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon('loading') : t('saveGuide')}
          </Button>
          {savedAt && !error && (
            <span className="flex items-center gap-2 text-sm font-medium text-moss">
              <Check className="size-4" aria-hidden />
              {t('guideSaved')}
            </span>
          )}
        </div>
      </form>
    </Form>
  );
}
