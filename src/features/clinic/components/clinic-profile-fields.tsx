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
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { COMMON_TIMEZONES } from '@/shared/const/timezone.const';

/**
 * The clinic half of both registration forms. Field names are passed in because the two forms
 * shape them differently — the signup form flattens `phone` to `clinicPhone` to avoid colliding
 * with the owner's own fields.
 */
type ClinicProfileFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  nameField: Path<T>;
  phoneField: Path<T>;
  cityField: Path<T>;
  countryField: Path<T>;
  addressField: Path<T>;
  timezoneField: Path<T>;
  localeField: Path<T>;
};

export function ClinicProfileFields<T extends FieldValues>({
  control,
  nameField,
  phoneField,
  cityField,
  countryField,
  addressField,
  timezoneField,
  localeField,
}: ClinicProfileFieldsProps<T>) {
  const t = useTranslations('clinic');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name={nameField}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>{t('name')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={cityField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('city')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={countryField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('country')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={addressField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('address')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={phoneField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('phone')}</FormLabel>
            <FormControl>
              <Input type="tel" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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
    </div>
  );
}
