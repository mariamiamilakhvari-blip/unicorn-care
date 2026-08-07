'use client';
import { BellOff, BellRing, CheckCircle2, Share } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PushDeniedNotice } from '@/features/notifications/components/push-denied-notice';
import { usePushSubscription } from '@/features/notifications/hooks/use-push-subscription';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

/**
 * Push opt-in card (PRD 04 §"Client flow").
 *
 * iOS/iPadOS only exposes Web Push to a home-screen-installed PWA (Safari 16.4+), so an
 * un-installed iOS visitor gets Add-to-Home-Screen instructions and NO enable button — tapping
 * one there would silently fail. Android and desktop Chromium get the button straight away.
 */
export const PushOptIn = () => {
  const t = useTranslations('push');
  const { status, isSupported, isIosNeedsInstall, enable } = usePushSubscription();

  if (!isSupported) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className="size-4 text-muted-foreground" />
            {t('unsupported')}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (isIosNeedsInstall) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share className="size-4 text-primary" />
            {t('addToHomeScreen')}
          </CardTitle>
          <CardDescription>{t('iosInstallHint')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === 'enabled') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-primary" />
            {t('notificationsEnabled')}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  /*
    Permission is a one-way door: once denied, the browser will not let us prompt again. So there
    is no button to offer and nothing for the patient to do here — it drops to a dismissable line
    rather than a card, and the plan gets the space back.
  */
  if (status === 'denied') return <PushDeniedNotice />;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="size-4 text-primary" />
          {t('enableNotifications')}
        </CardTitle>
        <CardDescription>{t('enableHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" className="w-full" disabled={status === 'pending'} onClick={enable}>
          {status === 'pending' ? t('enabling') : t('enableNotifications')}
        </Button>
      </CardContent>
    </Card>
  );
};
