'use client';

import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ScorePicker } from '@/features/rating/components/score-picker';
import { usePortalRatings } from '@/features/rating/hooks/use-portal-ratings';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

/**
 * Asked once, at the end, and never again.
 *
 * Shown only when a care plan has completed — a patient three days post-op is rating their pain,
 * not their care. There is no push and no email behind it: this waits in the portal for a patient
 * who chooses to open it, which is the difference between asking and chasing.
 *
 * Two questions, both stars. It carried four optional detail scores behind a fold and a free-text
 * box beneath them, which is six things to answer at the end of a recovery — and everything past
 * the second question cost completions rather than adding signal. A rating nobody finishes is
 * worth less than a rating of two stars that everybody does.
 */
export function PortalRatingCard() {
  const t = useTranslations('rating');
  const { ratable, isLoading, isSaving, hasError, submitted, submit } = usePortalRatings();

  const [doctorScore, setDoctorScore] = useState<number | null>(null);
  const [clinicScore, setClinicScore] = useState<number | null>(null);

  const target = ratable[0];

  if (isLoading || (!target && !submitted)) return null;

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <CircleCheck className="size-6 shrink-0 text-moss" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t('thanks')}</p>
            <p className="text-xs text-muted-foreground">{t('thanksHelp')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canSubmit = doctorScore !== null && clinicScore !== null && !isSaving;

  async function handleSubmit() {
    if (doctorScore === null || clinicScore === null || !target) return;
    await submit({ procedureId: target.procedureId, doctorScore, clinicScore });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ScorePicker
          label={t('doctorScore', { name: target.operatorName })}
          value={doctorScore}
          onChange={setDoctorScore}
          describeScore={score => t('scoreOf', { score })}
        />
        <ScorePicker
          label={t('clinicScore')}
          value={clinicScore}
          onChange={setClinicScore}
          describeScore={score => t('scoreOf', { score })}
        />

        {hasError && <p className="text-sm text-destructive">{t('saveFailed')}</p>}

        <Button disabled={!canSubmit} onClick={() => void handleSubmit()} className="self-start">
          {t('submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
