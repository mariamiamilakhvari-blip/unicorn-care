'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { DataRequestView } from '@/features/data-protection/types/data-protection.types';
import {
  DataRequestCreateSchema,
  DataRequestCreateType,
  DataRequestFormType,
} from '@/features/data-protection/validations/data-protection.validation';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Form,
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
import { Textarea } from '@/shared/components/ui/textarea';
import { DATA_REQUEST_KINDS, DataRequestKind } from '@/shared/const/data-request.const';

type DataRequestFormProps = {
  requests: DataRequestView[];
  onSubmit: (kind: DataRequestKind, detail: string) => Promise<void>;
};

/**
 * Where a patient asks for their record to be corrected or erased.
 *
 * The form says plainly that the clinic answers it, and the history below says what the clinic
 * said. That honesty is the design: a portal that took an erasure request and showed a success
 * message would imply the record had gone, when the Law of Georgia on Health Care requires the
 * clinical part of it to be kept — and the patient would only discover that much later, from
 * someone else.
 */
export function DataRequestForm({ requests, onSubmit }: DataRequestFormProps) {
  const t = useTranslations('privacy');
  const format = useFormatter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const form = useForm<DataRequestFormType, undefined, DataRequestCreateType>({
    resolver: zodResolver(DataRequestCreateSchema),
    defaultValues: { kind: 'correction', detail: '' },
  });

  async function handleSubmit(values: DataRequestCreateType) {
    setIsSubmitting(true);
    setHasFailed(false);
    try {
      await onSubmit(values.kind, values.detail);
      form.reset({ kind: 'correction', detail: '' });
    } catch {
      setHasFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('requestHeading')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">{t('requestHelp')}</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('requestKind')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DATA_REQUEST_KINDS.map(kind => (
                        <SelectItem key={kind} value={kind}>
                          {t(`requestKind_${kind}`)}
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
              name="detail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('requestDetail')}</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder={t('requestDetailHint')} {...field} />
                  </FormControl>
                  {/* The schema raises a bare code; the label under the field translates it. */}
                  {form.formState.errors.detail?.message === 'DETAIL_REQUIRED' ? (
                    <p className="text-sm font-medium text-destructive">{t('detailRequired')}</p>
                  ) : (
                    <FormMessage />
                  )}
                </FormItem>
              )}
            />

            {hasFailed && (
              <p className="text-sm font-medium text-destructive">{t('requestFailed')}</p>
            )}

            <Button type="submit" disabled={isSubmitting} className="self-start">
              {isSubmitting ? t('requestSending') : t('requestSubmit')}
            </Button>
          </form>
        </Form>

        {requests.length > 0 && (
          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('requestHistory')}
            </h3>
            <ul className="flex flex-col gap-3">
              {requests.map(request => (
                <li key={request.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{t(`requestKind_${request.kind}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(request.requestedAt), { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`requestStatus_${request.status}`)}
                  </p>
                  {/*
                    The clinic's answer, shown in full including a refusal. A refusal with its
                    stated basis is what the patient is owed; showing only the status would leave
                    them with "no" and no reason.
                  */}
                  {request.resolution && (
                    <p className="text-sm leading-relaxed">{request.resolution}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
