'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
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
import { AppLocale } from '@/shared/types/roles';

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

  useEffect(() => {
    if (!guide) return;
    reset({
      manipulationType,
      locale,
      expected: guide.expected,
      warning: guide.warning,
      isPublished: guide.isPublished,
    });
  }, [guide, manipulationType, locale, reset]);

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(save)} className="flex flex-col gap-5">
        <div>
          <h2 className="font-heading text-lg font-semibold">{t('title')}</h2>
          <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {/* Says plainly that this is shared content, so nobody edits it thinking it is
                specific to the patient in front of them. */}
            {guide?.isDefault ? t('usingDefault') : t('sharedAcrossPatients')}
          </p>
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
