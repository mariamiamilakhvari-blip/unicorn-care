'use client';

import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePortalSignOut } from '@/features/patient/hooks/use-portal-sign-out';
import { Button } from '@/shared/components/ui/button';

type PortalIdentityProps = {
  /** Empty when the record has been erased — the strip then says so instead of naming nobody. */
  patientName: string;
};

/**
 * Whose plan this is, on every portal screen.
 *
 * The portal had no answer to that question. A session lives in a cookie that outlasts the tab, so
 * a device that opened one patient's plan keeps opening it — and a link issued for somebody else
 * changes nothing until it is actually redeemed. That is not a corner case on a phone shared by a
 * family, or a clinic tablet handed between patients: it is what happens by default, and until
 * this strip existed the screen looked identical either way.
 *
 * It reads as a statement rather than a control, because for almost everybody it is one. The way
 * out sits beside it for the person who has just realised the name is not theirs — that reader is
 * looking at someone else's medication schedule, and the next thing they need is a door, not a
 * support article.
 */
export function PortalIdentity({ patientName }: PortalIdentityProps) {
  const t = useTranslations('portal');
  const { isSigningOut, signOut } = usePortalSignOut();

  return (
    <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-border bg-card px-3 py-2">
      <p className="flex items-center gap-2 text-sm">
        <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="text-muted-foreground">{t('viewingAs')}</span>
        {/*
          The name carries the weight, not the label — a patient scanning this strip is checking
          one word, and it has to be the one that stands out.
        */}
        <span className="font-medium">{patientName || t('viewingAsErased')}</span>
      </p>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isSigningOut}
        onClick={() => void signOut()}
      >
        {t('notYou')}
      </Button>
    </section>
  );
}
