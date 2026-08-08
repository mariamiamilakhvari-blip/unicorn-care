'use client';

import { MailWarning } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { useEmailDelivery } from '@/features/notifications/hooks/use-email-delivery';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

/**
 * A patient's email standing, shown to the clinic that can act on it.
 *
 * Rendered only when something is wrong. A card reporting "email is fine" on every patient is a
 * card nobody reads, and this one has to be noticed the one time it matters — the clinic is the
 * only party who can fix a wrong address, and until they do the patient is getting no reminders
 * by email at all.
 */
export function EmailDeliveryCard({ patientId }: { patientId: string }) {
  const t = useTranslations('emailDelivery');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const { delivery, isLoading, isClearing, error, clearSuppression } = useEmailDelivery(patientId);

  if (isLoading || !delivery) return null;
  // Nothing to report: no suppression and no failed deliveries worth surfacing.
  if (!delivery.isSuppressed && delivery.events.length === 0) return null;

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailWarning className="size-4 shrink-0 text-destructive" aria-hidden />
          {t('title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {delivery.isSuppressed && (
          <div className="flex flex-col gap-1">
            {/* Says what stopped and why, in that order — the why is what the clinic acts on. */}
            <p className="text-sm font-medium">{t(`reason.${delivery.reason || 'unknown'}`)}</p>
            <p className="text-xs text-muted-foreground">
              {t('suppressedSince', {
                email: delivery.email,
                date: delivery.suppressedAt
                  ? format.dateTime(new Date(delivery.suppressedAt), { dateStyle: 'medium' })
                  : '',
              })}
            </p>
            <p className="text-xs text-muted-foreground">{t('pushUnaffected')}</p>
          </div>
        )}

        {delivery.events.length > 0 && (
          <ul className="flex flex-col gap-2">
            {delivery.events.slice(0, 5).map(event => (
              <li key={event.id} className="rounded-md border border-border p-2 text-xs">
                <p className="font-medium">
                  {t(`kind.${event.kind}`)}
                  {event.bounceType && ` · ${t(`bounce.${event.bounceType}`)}`}
                </p>
                <p className="text-muted-foreground">
                  {format.dateTime(new Date(event.occurredAt), { dateStyle: 'medium' })}
                  {event.email && ` · ${event.email}`}
                </p>
                {/* The provider's own wording — it is what tells the clinic what to correct. */}
                {event.message && <p className="mt-1 text-muted-foreground">{event.message}</p>}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm font-medium text-destructive">{tCommon('error')}</p>}

        {delivery.isSuppressed && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{t('clearHelp')}</p>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={isClearing}
              onClick={() => void clearSuppression()}
            >
              {isClearing ? tCommon('loading') : t('clear')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
