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
import { Textarea } from '@/shared/components/ui/textarea';

/** "What is expected" — normal recovery signs, bounded to a day range after the procedure. */
export function ExpectedFields({ control }: { control: Control<RecoveryGuideFormType> }) {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const { fields, append, remove } = useFieldArray({ control, name: 'expected' });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">{t('expectedHeading')}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append({ title: '', description: '', fromDay: 0, toDay: 7 })}
        >
          <Plus className="size-4" aria-hidden />
          {t('addExpected')}
        </Button>
      </div>

      {fields.map((row, index) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
          {/* Twelfths, and the same day-column width as the warning rows below: the two lists sit
              one above the other, so their day fields should line up rather than nearly line up. */}
          <div className="grid gap-3 sm:grid-cols-12">
            <FormField
              control={control}
              name={`expected.${index}.title`}
              render={({ field }) => (
                <FormItem className="min-w-0 sm:col-span-8">
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
              name={`expected.${index}.fromDay`}
              render={({ field }) => (
                <FormItem className="min-w-0 sm:col-span-2">
                  <FormLabel>{t('fromDay')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={event => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`expected.${index}.toDay`}
              render={({ field }) => (
                <FormItem className="min-w-0 sm:col-span-2">
                  <FormLabel>{t('toDay')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
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
            name={`expected.${index}.description`}
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
