'use client';
import { BellRing, CheckCircle2, Share } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PushDeniedNotice } from '@/features/notifications/components/push-denied-notice';
import { usePushSubscription } from '@/features/notifications/hooks/use-push-subscription';
import { Button } from '@/shared/components/ui/button';

/**
 * Push opt-in (PRD 04 §"Client flow").
 *
 * A single quiet line, not a card, and never the first thing on the page. Notifications are an
 * optional convenience on a screen a patient opened to find out what to take and when — the plan
 * gets the prime space, and this sits with the other footer-weight controls.
 *
 * **Nothing is shown for a browser that cannot do it.** An iOS visitor who has not installed the
 * portal used to meet "Your browser does not support notifications" above their plan, which is
 * both prominent and useless: it names a limitation they did not ask about and cannot act on from
 * that sentence. Web Push on iOS/iPadOS reaches only a home-screen-installed PWA (Safari 16.4+),
 * so that state now renders a line the patient can open if they want it and nothing if they do
 * not. A browser with no Push API at all renders nothing whatsoever — there is no capability to
 * report and no action to offer.
 *
 * The permission prompt is still only ever raised from a real tap. That was already true and is
 * the reason `enable` exists rather than an effect: a drive-by prompt gets dismissed permanently,
 * and the browser will not let the app ask twice.
 */
export const PushOptIn = () => {
  const t = useTranslations('push');
  const { status, isSupported, isIosNeedsInstall, enable } = usePushSubscription();
  const [isIosHintOpen, setIsIosHintOpen] = useState(false);

  /*
    No Push API, no line. This is the case the banner was wrongly filling: there is nothing to
    enable, nothing to install, and nothing the patient could do with the information.
  */
  if (!isSupported) return null;

  /*
    iOS outside the installed app. There *is* something the patient can do, so the offer stays —
    but it costs one line and says nothing until it is asked. Tapping explains the install rather
    than requesting permission, which on this browser would fail silently.
  */
  if (isIosNeedsInstall) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit gap-2 px-2 text-sm text-muted-foreground hover:text-foreground"
          aria-expanded={isIosHintOpen}
          onClick={() => setIsIosHintOpen(open => !open)}
        >
          <BellRing className="size-4 shrink-0" aria-hidden />
          {t('enableNotifications')}
        </Button>

        {isIosHintOpen && (
          <p className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">{t('addToHomeScreen')}</span> — {t('iosInstallHint')}
            </span>
          </p>
        )}
      </div>
    );
  }

  /* Already on. Confirmation, in the smallest form that still confirms. */
  if (status === 'enabled') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
        {t('notificationsEnabled')}
      </p>
    );
  }

  /*
    Permission is a one-way door: once denied, the browser will not let us prompt again. There is
    no button to offer, so this drops to a dismissable line of its own.
  */
  if (status === 'denied') return <PushDeniedNotice />;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit gap-2"
      disabled={status === 'pending'}
      onClick={enable}
    >
      <BellRing className="size-4 shrink-0" aria-hidden />
      {status === 'pending' ? t('enabling') : t('enableNotifications')}
    </Button>
  );
};
