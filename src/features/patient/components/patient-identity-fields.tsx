'use client';
import { useTranslations } from 'next-intl';
import { Control } from 'react-hook-form';

import { CreatePatientFormType } from '@/features/patient/validations/patient.validation';
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

const SEX_KEYS = ['female', 'male', 'other'] as const;

/**
 * Who the patient is. Split out of `PatientForm` so that form stays readable now that it also
 * carries the consent block — the identity grid is the largest and least-changing half.
 */
export function PatientIdentityFields({ control }: { control: Control<CreatePatientFormType> }) {
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
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('email')}</FormLabel>
            <FormControl>
              <Input type="email" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="dateOfBirth"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('dateOfBirth')}</FormLabel>
            <FormControl>
              <Input
                type="date"
                value={typeof field.value === 'string' ? field.value : ''}
                onChange={event => field.onChange(event.target.value || null)}
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
