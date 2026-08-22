'use client';
import { useTranslations } from 'next-intl';
import { Control, FieldValues, Path } from 'react-hook-form';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { COMMON_TIMEZONES } from '@/shared/const/timezone.const';

/** The empty string is a value the picker has to be able to hold, and `SelectItem` cannot carry it. */
const INHERIT_VALUE = 'inherit';

type PatientTimezoneFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  /** Named in the "follow the clinic" option so the clinic can see what inheriting means. */
  clinicTimezone: string;
};

/**
 * Where the patient is recovering.
 *
 * Inheriting the clinic's zone is the first option and the default, because it is the truth for
 * every patient who has not gone anywhere — and because storing a copy of the clinic's zone would
 * silently strand that patient if the clinic ever corrected its own.
 *
 * A picker, not free text, for the reason the clinic's own field is one: "Tbilisi" reads as
 * correct and is not a valid IANA zone. The patient's own device overrides whatever is chosen here
 * the moment they open the portal — this is the answer until then, and the clinic's way to move a
 * patient who has not.
 */
export function PatientTimezoneField<T extends FieldValues>({
  control,
  name,
  clinicTimezone,
}: PatientTimezoneFieldProps<T>) {
  const t = useTranslations('patient');

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('timezone')}</FormLabel>
          <Select
            onValueChange={value => field.onChange(value === INHERIT_VALUE ? '' : value)}
            value={field.value ? String(field.value) : INHERIT_VALUE}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={INHERIT_VALUE}>
                {t('timezoneInherit', { zone: clinicTimezone.replace('_', ' ') })}
              </SelectItem>
              {COMMON_TIMEZONES.map(zone => (
                <SelectItem key={zone} value={zone}>
                  {zone.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>{t('timezoneHelp')}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
