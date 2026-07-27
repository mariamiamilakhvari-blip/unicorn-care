'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Control, useFieldArray } from 'react-hook-form';

import { CarePlanFormType, EMPTY_CHECKUP } from '@/features/care-plan/types/care-plan-form.types';
import { Button } from '@/shared/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';

export function CheckupFields({ control }: { control: Control<CarePlanFormType> }) {
  const t = useTranslations('carePlan');
  const { fields, append, remove } = useFieldArray({ control, name: 'checkups' });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">{t('checkups')}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_CHECKUP)}>
          <Plus className="size-4" aria-hidden />
          {t('addCheckup')}
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name={`checkups.${index}.title`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('checkupTitle')}</FormLabel>
                  <FormControl>
                    <Input {...input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`checkups.${index}.scheduledAt`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('scheduledAt')}</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`checkups.${index}.location`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('location')}</FormLabel>
                  <FormControl>
                    <Input {...input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`checkups.${index}.remindHoursBefore`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('remindHoursBefore')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={336}
                      value={input.value}
                      onChange={event => input.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-destructive"
            onClick={() => remove(index)}
          >
            <Trash2 className="size-4" aria-hidden />
            {t('removeItem')}
          </Button>
        </div>
      ))}
    </section>
  );
}
