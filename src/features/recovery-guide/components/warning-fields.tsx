'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Control, useFieldArray } from 'react-hook-form';

import { RecoveryGuideFormType } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { Button } from '@/shared/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { SubsectionTitle } from '@/shared/components/ui/section-title';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { WARNING_SEVERITIES, warningSeverityLabel } from '@/shared/const/recovery.const';
import { AppLocale } from '@/shared/types/roles';

type WarningFieldsProps = {
  control: Control<RecoveryGuideFormType>;
  /** The guide's own language. Severity labels follow it, not the clinician's interface. */
  locale: AppLocale;
};

/**
 * "When to contact the clinic". Severity is the clinic's own instruction to the patient — the
 * product never derives or upgrades it.
 */
export function WarningFields({ control, locale }: WarningFieldsProps) {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const { fields, append, remove } = useFieldArray({ control, name: 'warning' });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SubsectionTitle>{t('warningHeading')}</SubsectionTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append({ title: '', description: '', severity: 'call_clinic', durationDays: 14 })}
        >
          <Plus className="size-4" aria-hidden />
          {t('addWarning')}
        </Button>
      </div>

      {fields.map((row, index) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
          {/*
            Twelfths rather than four equal columns: the four fields are nothing like equal. The
            title is a sentence, the severity is a phrase, and the two day fields hold at most three
            digits each — split evenly, the title truncated while the day inputs sat mostly empty.
          */}
          <div className="grid gap-3 sm:grid-cols-12">
            <FormField
              control={control}
              name={`warning.${index}.title`}
              render={({ field }) => (
                <FormItem className="min-w-0 sm:col-span-6">
                  <FormLabel>{t('itemTitle')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`warning.${index}.severity`}
              render={({ field }) => (
                <FormItem className="min-w-0 sm:col-span-3">
                  <FormLabel>{t('severityLabel')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WARNING_SEVERITIES.map(value => (
                        <SelectItem key={value} value={value}>
                          {warningSeverityLabel(locale, value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`warning.${index}.durationDays`}
              render={({ field }) => (
                <FormItem className="min-w-0 sm:col-span-3">
                  <FormLabel>{t('durationDays')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={field.value ?? 0}
                      onChange={event => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name={`warning.${index}.description`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start text-destructive"
            onClick={() => remove(index)}
          >
            <Trash2 className="size-4" aria-hidden />
            {tCommon('delete')}
          </Button>
        </div>
      ))}
    </section>
  );
}
