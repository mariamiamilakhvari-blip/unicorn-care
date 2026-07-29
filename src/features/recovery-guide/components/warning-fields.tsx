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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { WARNING_SEVERITIES } from '@/shared/const/recovery.const';

/**
 * "When to contact the clinic". Severity is the clinic's own instruction to the patient — the
 * product never derives or upgrades it.
 */
export function WarningFields({ control }: { control: Control<RecoveryGuideFormType> }) {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const { fields, append, remove } = useFieldArray({ control, name: 'warning' });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">{t('warningHeading')}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append({ title: '', description: '', severity: 'call_clinic', fromDay: 0, toDay: 14 })}
        >
          <Plus className="size-4" aria-hidden />
          {t('addWarning')}
        </Button>
      </div>

      {fields.map((row, index) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <FormField
              control={control}
              name={`warning.${index}.title`}
              render={({ field }) => (
                <FormItem>
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
                <FormItem>
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
                          {t(`severity.${value}`)}
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
              name={`warning.${index}.fromDay`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fromDay')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value ?? 0}
                      onChange={event => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`warning.${index}.toDay`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('toDay')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
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
