'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { useResetPassword } from '@/features/auth/hooks/use-reset-password';
import {
  ResetPasswordFormSchema,
  ResetPasswordFormType,
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
import { FORGOT_PASSWORD_ROUTE, SIGN_IN_ROUTE } from '@/shared/const/routes.const';

type ResetPasswordFormProps = {
  token: string;
  /** Whether the token was still redeemable when the page rendered. */
  isTokenValid: boolean;
};

export const ResetPasswordForm = ({ token, isTokenValid }: ResetPasswordFormProps) => {
  const t = useTranslations('auth');
  const { resetPassword, changed, loading, error } = useResetPassword(token);

  const form = useForm<ResetPasswordFormType>({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  /*
    Checked on the server before anything is drawn, so someone arriving on a dead link is told at
    once instead of after choosing and confirming a password that has nowhere to go.
  */
  if (!isTokenValid) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('resetLinkInvalidTitle')}</CardTitle>
          <CardDescription>{t('resetLinkInvalid')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={FORGOT_PASSWORD_ROUTE}>{t('requestNewLink')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (changed) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('passwordChangedTitle')}</CardTitle>
          <CardDescription>{t('passwordChangedDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={SIGN_IN_ROUTE}>{t('signIn')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  /* Only the mismatch rule is translated here; a length complaint is still `FormMessage`'s job. */
  const mismatch = form.formState.errors.confirmPassword?.message === 'PASSWORD_MISMATCH';

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{t('resetPasswordTitle')}</CardTitle>
        <CardDescription>{t('resetPasswordDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(values => resetPassword(values.password))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newPassword')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('confirmPassword')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  {/*
                    Not `FormMessage`: it prints the schema's own message, and the mismatch rule
                    raises a code rather than prose so the schema stays language-free.
                  */}
                  {mismatch ? (
                    <p className="text-sm font-medium text-destructive">{t('passwordMismatch')}</p>
                  ) : (
                    <FormMessage />
                  )}
                </FormItem>
              )}
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('savingPassword') : t('savePassword')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
