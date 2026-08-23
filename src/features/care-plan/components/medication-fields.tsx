'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Control, useFieldArray, useFormContext } from 'react-hook-form';

import { TimesOfDayField } from '@/features/care-plan/components/times-of-day-field';
import {
  CarePlanFormType,
  EMPTY_MEDICATION,
} from '@/features/care-plan/types/care-plan-form.types';
import { ROUTE_VALUES } from '@/features/care-plan/validations/care-plan.validation';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { SectionTitle } from '@/shared/components/ui/section-title';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export function MedicationFields({ control }: { control: Control<CarePlanFormType> }) {
  const t = useTranslations('carePlan');
  const { fields, append, remove } = useFieldArray({ control, name: 'medications' });
  const form = useFormContext<CarePlanFormType>();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionTitle>{t('medications')}</SectionTitle>
        <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_MEDICATION)}>
          <Plus className="size-4" aria-hidden />
          {t('addMedication')}
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name={`medications.${index}.name`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('medicationName')}</FormLabel>
                  <FormControl>
                    <Input {...input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`medications.${index}.dosage`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('dosage')}</FormLabel>
                  <FormControl>
                    <Input placeholder="500 mg" {...input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`medications.${index}.route`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('route.label')}</FormLabel>
                  <Select onValueChange={input.onChange} value={input.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROUTE_VALUES.map(value => (
                        <SelectItem key={value} value={value}>
                          {t(`route.${value}`)}
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
              name={`medications.${index}.startsOn`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('startsOn')}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...input}
                      onChange={event => {
                        input.onChange(event);
                        // The "ends before starts" error is attached to endsOn, so fixing
                        // startsOn would otherwise leave a stale error blocking save.
                        void form.trigger(`medications.${index}.endsOn`);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`medications.${index}.endsOn`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('endsOn')}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...input}
                      onChange={event => {
                        input.onChange(event);
                        void form.trigger(`medications.${index}.endsOn`);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <TimesOfDayField
            value={form.watch(`medications.${index}.timesOfDay`)}
            onChange={next => form.setValue(`medications.${index}.timesOfDay`, next)}
          />

          <FormField
            control={control}
            name={`medications.${index}.withFood`}
            render={({ field: input }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <FormControl>
                  <Checkbox checked={input.value} onCheckedChange={input.onChange} />
                </FormControl>
                <FormLabel className="font-normal">{t('withFood')}</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`medications.${index}.remindMinutesBefore`}
            render={({ field: input }) => (
              <FormItem className="sm:max-w-xs">
                <FormLabel>{t('remindMinutesBefore')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    value={input.value ?? 0}
                    onChange={event => input.onChange(Number(event.target.value))}
                  />
                </FormControl>
                <FormDescription>{t('remindMinutesBeforeHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
