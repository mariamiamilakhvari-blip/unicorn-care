'use client';

import { useTranslations } from 'next-intl';
import { Control, FieldValues, Path } from 'react-hook-form';

import { ClinicEnglishFields } from '@/features/clinic/components/clinic-english-fields';
import { ClinicPreferenceFields } from '@/features/clinic/components/clinic-preference-fields';
import { ClinicTaxIdField } from '@/features/clinic/components/clinic-tax-id-field';
import { CodedFormMessage } from '@/shared/components/coded-form-message';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';

/** The email rule raises one code; the tax ID rule's map is data and lives in its const file. */
const EMAIL_MESSAGE_KEYS = { INVALID_EMAIL: 'emailInvalid' };

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
  /*
    Where the registry's legal name is written when a lookup succeeds.

    Separate from `nameField` because the sign-up form renders the clinic name itself, above the
    credentials, and calls it `clinicName` — so the field this component fills is not always a
    field this component draws.
  */
  legalNameField: Path<T>;
  /** The optional public-facing name. Drawn under the legal name, since it qualifies it. */
  brandNameField: Path<T>;
  /*
    The name and address English-language emails use. Drawn together by `ClinicEnglishFields`, so
    they are passed as a pair or not at all.

    Optional, and passed by the settings form alone. Registration is already the longest form in
    the product and asks this at the worst moment — a clinic signing up has not sent an email yet,
    so it has no reason to know why a second name is wanted. Settings is where a clinic goes once
    it has seen one.
  */
  nameEnField?: Path<T>;
  addressEnField?: Path<T>;
  phoneField: Path<T>;
  /*
    Optional for the same reason `nameField` is: the registration form asks for the owner's login
    email in its own credentials row, and a second email box directly beneath it would read as a
    confirmation field. Settings and onboarding pass it and get the clinic's contact address.
  */
  emailField?: Path<T>;
  cityField: Path<T>;
  countryField: Path<T>;
  addressField: Path<T>;
  taxIdField: Path<T>;
  timezoneField: Path<T>;
  localeField: Path<T>;
};

export function ClinicProfileFields<T extends FieldValues>({
  control,
  nameField,
  legalNameField,
  brandNameField,
  nameEnField,
  addressEnField,
  phoneField,
  emailField,
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
      {/*
        Directly under the legal name it qualifies.

        Optional, and it exists because the lookup made it necessary: the name field now fills
        itself from the Public Registry, and what the registry holds is the legal entity —
        "შპს მედალფა ჯგუფი" — which is not what the practice puts on its door or what a patient
        would recognise on a reminder. Before autofill a clinic simply typed its trading name into
        the name field and no second field was wanted.
      */}
      <FormField
        control={control}
        name={brandNameField}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>{t('brandName')}</FormLabel>
            <FormControl>
              <Input placeholder={t('brandNamePlaceholder')} {...field} />
            </FormControl>
            <FormDescription>{t('brandNameHelp')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {/*
        Directly under the clinic name, above the address block: it is how the practice is
        reached, which belongs with what the practice is called rather than with where it is.
      */}
      {emailField && (
        <FormField
          control={control}
          name={emailField}
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormDescription>{t('emailHelp')}</FormDescription>
              <CodedFormMessage namespace="clinic" keys={EMAIL_MESSAGE_KEYS} />
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
      {/* After the Georgian address and phone, since it restates what they already said. */}
      {nameEnField && addressEnField && (
        <ClinicEnglishFields
          control={control}
          nameEnField={nameEnField}
          addressEnField={addressEnField}
        />
      )}
      <ClinicTaxIdField
        control={control}
        taxIdField={taxIdField}
        legalNameField={legalNameField}
        addressField={addressField}
        cityField={cityField}
      />
      <ClinicPreferenceFields
        control={control}
        timezoneField={timezoneField}
        localeField={localeField}
      />
    </div>
  );
}
