'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { useForgotPassword } from '@/features/auth/hooks/use-forgot-password';
import {
  ForgotPasswordSchema,
  ForgotPasswordType,
} from '@/features/auth/validations/auth.validation';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { SIGN_IN_ROUTE } from '@/shared/const/routes.const';

export const ForgotPasswordForm = () => {
  const t = useTranslations('auth');
  const { requestReset, requested, loading, error } = useForgotPassword();

  const form = useForm<ForgotPasswordType>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  /*
    The confirmation never says an email was sent — the endpoint refuses to reveal whether the
    address has an account, and copy that claimed a send would give away exactly what the endpoint
    withholds. "If there is an account, a link is on its way" is both true and unhelpful to someone
    probing for members.
  */
  if (requested) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('resetRequestedTitle')}</CardTitle>
          <CardDescription>{t('resetRequestedDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href={SIGN_IN_ROUTE}>{t('backToSignIn')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{t('forgotPasswordTitle')}</CardTitle>
        <CardDescription>{t('forgotPasswordDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(requestReset)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('email')}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t('emailPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('sendingResetLink') : t('sendResetLink')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href={SIGN_IN_ROUTE} className="underline underline-offset-4 hover:text-primary">
                {t('backToSignIn')}
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
