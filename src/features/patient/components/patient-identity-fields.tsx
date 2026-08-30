'use client';
import { useTranslations } from 'next-intl';
import { Control } from 'react-hook-form';

import { CreatePatientFormType } from '@/features/patient/validations/patient.validation';
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
import { MAX_PATIENT_AGE, MIN_PATIENT_AGE } from '@/shared/const/patient.const';
import { suggestEmailCorrection } from '@/shared/utils/email-domain';

const SEX_KEYS = ['female', 'male', 'other'] as const;

/**
 * Who the patient is. Split out of `PatientForm` so that form stays readable now that it also
 * carries the consent block — the identity grid is the largest and least-changing half.
 */
type PatientIdentityFieldsProps = {
  control: Control<CreatePatientFormType>;
};

export function PatientIdentityFields({ control }: PatientIdentityFieldsProps) {
  const t = useTranslations('patient');
  const tCommon = useTranslations('common');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="firstName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('firstName')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="lastName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('lastName')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="phone"
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
      <FormField
        control={control}
        name="email"
        render={({ field }) => {
          /*
            A suggestion, never a correction. Rewriting what a clinic typed into a patient record
            is how a reminder carrying someone's medication reaches a stranger's inbox — and the
            clinic would never learn it had happened. Applying it is one deliberate click.
          */
          const suggestion = suggestEmailCorrection(String(field.value ?? ''));
          const isBlank = String(field.value ?? '').trim().length === 0;

          return (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              {/*
                Said at the moment the field is empty, not discovered weeks later on a dashboard.
                A patient with no address and no push subscription receives nothing at all, and
                the plan still looks alive from the clinic's side — this is the cheapest point to
                collect it, and the message says what the blank costs rather than that it is
                merely optional.
              */}
              {isBlank && <FormDescription>{t('emailBlankWarning')}</FormDescription>}
              {suggestion && (
                <FormDescription>
                  {t('emailSuggestion')}{' '}
                  <button
                    type="button"
                    onClick={() => field.onChange(suggestion)}
                    className="font-medium underline underline-offset-4"
                  >
                    {suggestion}
                  </button>
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          );
        }}
      />
      <FormField
        control={control}
        name="age"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('age')}</FormLabel>
            <FormControl>
              {/*
                Cleared back to null rather than to `0`, because an empty box means the clinic did
                not ask — and a newborn is a real patient, so the two cannot share a value.
                `Number` is applied here rather than left to the resolver so the field holds a
                number the moment it is typed; `min`/`max` are the browser's echo of the Zod
                bounds, never the check itself.
              */}
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_PATIENT_AGE}
                max={MAX_PATIENT_AGE}
                step={1}
                value={typeof field.value === 'number' ? field.value : ''}
                onChange={event =>
                  field.onChange(event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="sex"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('sex')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="unspecified">{tCommon('none')}</SelectItem>
                {SEX_KEYS.map(key => (
                  <SelectItem key={key} value={key}>
                    {t(`sex${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
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
        name="locale"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{tCommon('language')}</FormLabel>
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
