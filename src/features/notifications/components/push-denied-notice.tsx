'use client';

import { BellOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useDismissed } from '@/features/notifications/hooks/use-dismissed';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { PUSH_DENIED_DISMISSED_KEY, PUSH_FIX_STEP_KEYS } from '@/shared/const/push.const';

/**
 * What the portal shows once notification permission has been refused.
 *
 * Deliberately the quietest thing on the page. Permission is a one-way door — the browser will
 * not let the app ask again — so this is a note about an optional convenience, not a fault the
 * patient has to resolve. It used to be a full card with a title, which read like an error and
 * sat above the plan the patient actually opened the portal for.
 *
 * Dismissal is remembered in `localStorage` rather than component state: a patient who has
 * decided against notifications should not be told about it again on every visit, and this must
 * survive the page reload that follows completing a task.
 */
export function PushDeniedNotice() {
  const t = useTranslations('push');
  const { isDismissed, dismiss } = useDismissed(PUSH_DENIED_DISMISSED_KEY);

  if (isDismissed) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
      <BellOff className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">{t('permissionDenied')}</p>

      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
            {t('howToFix')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('howToFixTitle')}</DialogTitle>
            <DialogDescription>{t('howToFixIntro')}</DialogDescription>
          </DialogHeader>
          {/*
            Numbered because these are steps taken in order, in a settings UI the patient has to
            navigate while holding a phone. The wording stays browser-neutral: the portal cannot
            tell Chrome from Safari reliably enough to give one set of exact taps.
          */}
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
            {PUSH_FIX_STEP_KEYS.map(key => (
              <li key={key}>{t(`fixStep.${key}`)}</li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={dismiss}
        aria-label={t('dismiss')}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
