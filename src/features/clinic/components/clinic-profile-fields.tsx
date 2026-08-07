'use client';

import { useTranslations } from 'next-intl';
import { Control, FieldValues, Path } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { TAX_ID_MESSAGE_KEYS, TaxIdIssue } from '@/shared/const/tax-id.const';
import { COMMON_TIMEZONES } from '@/shared/const/timezone.const';

/**
 * The clinic half of both registration forms. Field names are passed in because the two forms
 * shape them differently — the signup form flattens `phone` to `clinicPhone` to avoid colliding
 * with the owner's own fields.
 */
type ClinicProfileFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  /*
    Optional. Registration puts the clinic name at the very top, above the account credentials,
    because that is the question the form is really asking — so it renders that field itself and
    leaves this unset. Onboarding and settings still pass it and get it in place.
  */
  nameField?: Path<T>;
  phoneField: Path<T>;
  cityField: Path<T>;
  countryField: Path<T>;
  addressField: Path<T>;
  taxIdField: Path<T>;
  timezoneField: Path<T>;
  localeField: Path<T>;
};

/**
 * The tax ID rule raises a bare code — `INVALID_TAX_ID_GE` and friends — which is fine on the wire
 * and useless to a clinic owner reading a form. `FormMessage` always prefers `error.message` over
 * its children, so translating it means rendering the paragraph here — reusing `formMessageId` so
 * the input's `aria-describedby` still resolves. Anything that is not one of the codes (a length
 * error, say) falls through unchanged.
 */
function TaxIdMessage() {
  const t = useTranslations('clinic');
  const { error, formMessageId } = useFormField();

  if (!error) return null;

  const code = String(error.message ?? '');
  const messageKey = TAX_ID_MESSAGE_KEYS[code as TaxIdIssue];

  return (
    <p id={formMessageId} className="text-sm font-medium text-destructive">
      {messageKey ? t(messageKey) : code}
    </p>
  );
}

export function ClinicProfileFields<T extends FieldValues>({
  control,
  nameField,
  phoneField,
  cityField,
  countryField,
  addressField,
  taxIdField,
  timezoneField,
  localeField,
}: ClinicProfileFieldsProps<T>) {
  const t = useTranslations('clinic');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {nameField && (
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
      )}
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
      {/*
        Spans both columns: the label is long in either language, and the value it holds is what
        an invoice is raised against, so it should not read as an afterthought beside the phone.
      */}
      <FormField
        control={control}
        name={taxIdField}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>{t('taxId')}</FormLabel>
            <FormControl>
              <Input placeholder={t('taxIdPlaceholder')} autoComplete="off" {...field} />
            </FormControl>
            <TaxIdMessage />
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
