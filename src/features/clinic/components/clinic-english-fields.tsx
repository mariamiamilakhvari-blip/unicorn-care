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
import { Input } from '@/shared/components/ui/input';

type ClinicEnglishFieldsProps<T extends FieldValues> = {
  control: Control<T>;
  nameEnField: Path<T>;
  addressEnField: Path<T>;
};

/**
 * How the clinic names itself in the emails that go out in English.
 *
 * A patient can be written to in English while the practice is a Georgian one, and until these
 * existed the footer of that email translated its labels and left the values it labelled in
 * Mkhedruli — "Address: საბურთალო: ვაჟა-ფშაველას გამზ. N40" — because the record held exactly one
 * string per field.
 *
 * The platform does not translate them. A clinic's name in English is whatever the clinic says it
 * is, and the address has to be one a patient or a courier can actually follow, so both are typed
 * here. Kept as their own pair rather than each sitting beside its Georgian twin: they answer one
 * question between them, and one description under the two is clearer than the same sentence
 * repeated in two places on the form.
 *
 * Both are optional, and empty is the normal case — the emails then carry the Georgian original,
 * which still tells a patient who wrote to them.
 */
export function ClinicEnglishFields<T extends FieldValues>({
  control,
  nameEnField,
  addressEnField,
}: ClinicEnglishFieldsProps<T>) {
  const t = useTranslations('clinic');

  return (
    <>
      <FormField
        control={control}
        name={nameEnField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('nameEn')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormDescription>{t('nameEnHelp')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={addressEnField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('addressEn')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormDescription>{t('addressEnHelp')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
