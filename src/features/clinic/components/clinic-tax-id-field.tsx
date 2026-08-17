'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { Control, FieldValues, Path, PathValue, useFormContext } from 'react-hook-form';

import { CompanyLookupStatus } from '@/features/clinic/components/company-lookup-status';
import { useCompanyLookup } from '@/features/clinic/hooks/use-company-lookup';
import { CompanyLookup } from '@/features/clinic/types/clinic.types';
import { CodedFormMessage } from '@/shared/components/coded-form-message';
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Spinner } from '@/shared/components/ui/spinner';
import { NAPR_EXAMPLE_TAX_ID } from '@/shared/const/napr.const';
import { TAX_ID_MESSAGE_KEYS } from '@/shared/const/tax-id.const';

type ClinicTaxIdFieldProps<T extends FieldValues> = {
  control: Control<T>;
  taxIdField: Path<T>;
  /*
    Where a matched legal name is written. Not `nameField`: the sign-up form draws the clinic name
    itself, above the credentials, under the name `clinicName` — so the field filled here is not
    always a field the profile block draws.
  */
  legalNameField: Path<T>;
  addressField: Path<T>;
  cityField: Path<T>;
};

/**
 * The tax ID input, and the Public Registry lookup hanging off it.
 *
 * Its own component rather than another branch of `ClinicProfileFields` because it is the only
 * field there that does anything: it owns a debounce, an in-flight state, a remote failure mode
 * and the writes into three other fields. Everything else in that file is a labelled input.
 */
export function ClinicTaxIdField<T extends FieldValues>({
  control,
  taxIdField,
  legalNameField,
  addressField,
  cityField,
}: ClinicTaxIdFieldProps<T>) {
  const t = useTranslations('clinic');
  /*
    Every form rendering this wraps it in `<Form {...form}>`, which is RHF's own `FormProvider` —
    so the writer for the autofill is already in context and needs no prop of its own.
  */
  const { setValue } = useFormContext<T>();

  const fill = useCallback(
    (path: Path<T>, value: string) => {
      /*
        `shouldValidate` so a name arriving from the registry clears a "name is required" error the
        clinic may already be looking at; `shouldDirty` so it counts as a real edit and is
        submitted rather than treated as an untouched default.
      */
      setValue(path, value as PathValue<T, Path<T>>, { shouldDirty: true, shouldValidate: true });
    },
    [setValue]
  );

  const onCompanyFound = useCallback(
    (company: CompanyLookup) => {
      fill(legalNameField, company.legalName);
      /*
        Guarded, unlike the name. The registry publishes an address only behind a CAPTCHA, so these
        arrive empty today — and writing an empty string over an address the clinic has already
        typed would make the lookup destructive. If a source for them ever appears this fills them;
        until then it correctly does nothing.
      */
      if (company.address) fill(addressField, company.address);
      if (company.city) fill(cityField, company.city);
    },
    [fill, legalNameField, addressField, cityField]
  );

  const { isLooking, error, company, lookup, lookupNow } = useCompanyLookup(onCompanyFound);

  return (
    <FormField
      control={control}
      name={taxIdField}
      /*
        Spans both columns: the label is long in either language, and the value it holds is what an
        invoice is raised against, so it should not read as an afterthought beside the phone.
      */
      render={({ field }) => (
        <FormItem className="sm:col-span-2">
          <FormLabel>{t('taxId')}</FormLabel>
          {/*
            The positioning wrapper sits outside `FormControl`, not inside it. `FormControl` is a
            Slot: it clones `id`, `aria-describedby` and `aria-invalid` onto its single child. Give
            it a `div` and the label's `htmlFor` resolves to that div, the input loses its id, and
            clicking the label focuses nothing.
          */}
          <div className="relative">
            <FormControl>
              <Input
                placeholder={t('taxIdPlaceholder', { example: NAPR_EXAMPLE_TAX_ID })}
                autoComplete="off"
                // Not `type="number"`: leading zeros are significant and a stepper UI is wrong here.
                inputMode="numeric"
                // Room for the spinner, so a long code never runs underneath it.
                className="pr-9"
                {...field}
                onChange={event => {
                  field.onChange(event);
                  lookup(event.target.value);
                }}
                /*
                  Blur searches immediately, on top of the debounce, for the clinic that types the
                  ninth digit and tabs straight out before the timer elapses. The hook remembers
                  what it last asked about, so the two paths cannot both fire for one code.
                */
                onBlur={() => {
                  field.onBlur();
                  lookupNow(String(field.value ?? ''));
                }}
              />
            </FormControl>
            {isLooking && (
              <Spinner
                label={t('companyLookupPending')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            )}
          </div>
          <CodedFormMessage namespace="clinic" keys={TAX_ID_MESSAGE_KEYS} />
          {/*
            Below the schema's own message, not instead of it. They answer different questions —
            "this is not a valid code" versus "no company holds this code" — and a clinic that
            mistypes a digit into another real company's code needs to see the second while the
            first stays silent.
          */}
          <CompanyLookupStatus error={error} company={company} />
        </FormItem>
      )}
    />
  );
}
