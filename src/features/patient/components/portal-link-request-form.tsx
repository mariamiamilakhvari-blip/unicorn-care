'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { usePortalLinkRequest } from '@/features/patient/hooks/use-portal-link-request';
import {
  PortalLinkRequestSchema,
  PortalLinkRequestType,
} from '@/features/patient/validations/portal-link.validation';
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

/**
 * The way out of the dead end.
 *
 * Before this, a patient whose portal no longer opened was told to contact their clinic and left
 * there — on a phone, mid-recovery, usually out of hours. The email a patient receives carries no
 * token by design, so this is what turns "contact your clinic" into something they can do at 2am.
 */
export function PortalLinkRequestForm() {
  const t = useTranslations('portal');
  const { requestLink, requested, loading, error } = usePortalLinkRequest();

  const form = useForm<PortalLinkRequestType>({
    resolver: zodResolver(PortalLinkRequestSchema),
    defaultValues: { email: '' },
  });

  /*
    The confirmation never claims an email was sent. The endpoint refuses to say whether an address
    belongs to a patient — a patient list is a list of people who had surgery at a named clinic —
    and copy that promised a send would give away precisely what the endpoint withholds.
  */
  if (requested) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-primary-edge bg-moss/10 p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-moss" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t('linkRequestedTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('linkRequestedHelp')}</p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(requestLink)} className="flex flex-col gap-3">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('linkRequestEmail')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? t('linkRequestSending') : t('linkRequestSubmit')}
        </Button>
      </form>
    </Form>
  );
}
