'use client';

import { LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePortalLogin } from '@/features/patient/hooks/use-portal-login';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type PortalLoginConfirmProps = {
  token: string;
};

/**
 * One button between the emailed link and the portal.
 *
 * It exists to be pressed by a person. A single-use link that redeemed itself on page load was
 * spent by every mail-security scanner that fetched the URL before delivery, so the patient
 * following their own link arrived to find it already used.
 */
export function PortalLoginConfirm({ token }: PortalLoginConfirmProps) {
  const t = useTranslations('portal');
  const { openPortal, loading, error } = usePortalLogin(token);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="size-5 text-primary" aria-hidden />
            {t('portalLoginTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('portalLoginHelp')}</p>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button onClick={openPortal} disabled={loading}>
            {loading ? t('portalLoginOpening') : t('portalLoginSubmit')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
