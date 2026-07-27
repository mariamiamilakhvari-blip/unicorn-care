'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { ProcedureView } from '@/features/procedure/types/procedure.types';
import {
  ANESTHESIA_VALUES,
  CreateProcedureSchema,
  CreateProcedureType,
} from '@/features/procedure/validations/procedure.validation';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
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
import { Textarea } from '@/shared/components/ui/textarea';
import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';

type ProcedureFormProps = {
  patientId: string;
  onSubmit: (values: CreateProcedureType) => Promise<void>;
  isPending: boolean;
  /** Present when editing — the form prefills and stops clearing itself after submit. */
  procedure?: ProcedureView | null;
};

export function ProcedureForm({
  patientId,
  onSubmit,
  isPending,
  procedure = null,
}: ProcedureFormProps) {
  const t = useTranslations('procedure');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const form = useForm<CreateProcedureType>({
    resolver: zodResolver(CreateProcedureSchema),
    defaultValues: {
      patientId,
      // `datetime-local` needs `yyyy-MM-ddTHH:mm`; the stored value is a full ISO string.
      performedAt: procedure ? procedure.performedAt.slice(0, 16) : '',
      operatorName: procedure?.operatorName ?? '',
      operatorUserId: null,
      manipulationType: procedure?.manipulationType ?? PROCEDURE_TYPES[0].key,
      manipulationDetail: procedure?.manipulationDetail ?? '',
      anesthesia: (procedure?.anesthesia as CreateProcedureType['anesthesia']) ?? 'local',
      notes: procedure?.notes ?? '',
    },
  });

  async function handleSubmit(values: CreateProcedureType) {
    await onSubmit(values);
    if (procedure) return;
    form.reset({ ...form.getValues(), performedAt: '', manipulationDetail: '', notes: '' });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="performedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('performedAt')}</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="operatorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('operator')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="manipulationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('manipulationType')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROCEDURE_TYPES.map(type => (
                      <SelectItem key={type.key} value={type.key}>
                        {locale === 'ka' ? type.ka : type.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="anesthesia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('anesthesia')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ANESTHESIA_VALUES.map(value => (
                      <SelectItem key={value} value={value}>
                        {t(`anesthesiaOption.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('notes')}</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="self-start">
          {procedure ? tCommon('save') : t('createProcedure')}
        </Button>
      </form>
    </Form>
  );
}
