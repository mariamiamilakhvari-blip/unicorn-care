'use client';

import { useTranslations } from 'next-intl';
import { Control, FieldValues, Path } from 'react-hook-form';

import {
  FormControl,
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

type ClinicPreferenceFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  timezoneField: Path<T>;
  localeField: Path<T>;
};

/**
 * The two settings that decide *when* and *in what language* a clinic's patients are written to.
 *
 * Grouped away from the address block because they are not contact details — they are the two
 * inputs the reminder pipeline reads, and they are the only fields here that are pickers rather
 * than free text.
 */
export function ClinicPreferenceFields<T extends FieldValues>({
  control,
  timezoneField,
  localeField,
}: ClinicPreferenceFieldsProps<T>) {
  const t = useTranslations('clinic');

  return (
    <>
      {/* A picker, not free text: "Tbilisi" reads as correct and is not a valid IANA zone. */}
      <FormField
        control={control}
        name={timezoneField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('timezone')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {COMMON_TIMEZONES.map(zone => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replace('_', ' ')}
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
        name={localeField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('locale')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="ka">ქართული</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
