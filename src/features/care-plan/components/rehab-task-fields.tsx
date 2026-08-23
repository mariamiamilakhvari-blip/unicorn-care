'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Control, useFieldArray, useFormContext } from 'react-hook-form';

import { TimesOfDayField } from '@/features/care-plan/components/times-of-day-field';
import {
  CarePlanFormType,
  EMPTY_REHAB_TASK,
} from '@/features/care-plan/types/care-plan-form.types';
import { INTENSITY_VALUES } from '@/features/care-plan/validations/care-plan.validation';
import { Button } from '@/shared/components/ui/button';
import {
  FormControl,
  FormDescription,
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

export function RehabTaskFields({ control }: { control: Control<CarePlanFormType> }) {
  const t = useTranslations('carePlan');
  const { fields, append, remove } = useFieldArray({ control, name: 'rehabTasks' });
  const form = useFormContext<CarePlanFormType>();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">{t('rehabTasks')}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_REHAB_TASK)}>
          <Plus className="size-4" aria-hidden />
          {t('addRehabTask')}
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name={`rehabTasks.${index}.title`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('taskTitle')}</FormLabel>
                  <FormControl>
                    <Input {...input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`rehabTasks.${index}.intensity`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('intensity.label')}</FormLabel>
                  <Select onValueChange={input.onChange} value={input.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INTENSITY_VALUES.map(value => (
                        <SelectItem key={value} value={value}>
                          {t(`intensity.${value}`)}
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
              name={`rehabTasks.${index}.durationMinutes`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('sessionLength')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={600}
                      value={input.value}
                      onChange={event => input.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  {/*
                    Named for what it is. Labelled "Duration" it sat directly above a start and an
                    end date and read as a third way of saying the same thing, which is how it came
                    to look like a redundant field worth deleting — it is neither: it is how long
                    one session lasts, and it is the `· 10 წთ` the patient reads on the reminder.
                  */}
                  <FormDescription>{t('sessionLengthHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`rehabTasks.${index}.startsOn`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('startsOn')}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...input}
                      onChange={event => {
                        input.onChange(event);
                        // Same stale-error problem as medications: the message lives on endsOn.
                        void form.trigger(`rehabTasks.${index}.endsOn`);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`rehabTasks.${index}.endsOn`}
              render={({ field: input }) => (
                <FormItem>
                  <FormLabel>{t('endsOn')}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...input}
                      onChange={event => {
                        input.onChange(event);
                        void form.trigger(`rehabTasks.${index}.endsOn`);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <TimesOfDayField
            value={form.watch(`rehabTasks.${index}.timesOfDay`)}
            onChange={next => form.setValue(`rehabTasks.${index}.timesOfDay`, next)}
          />

          <FormField
            control={control}
            name={`rehabTasks.${index}.description`}
            render={({ field: input }) => (
              <FormItem>
                <FormLabel>{t('taskDescription')}</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...input} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />


          <FormField
            control={control}
            name={`rehabTasks.${index}.remindMinutesBefore`}
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
