'use client';

import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ScorePicker } from '@/features/rating/components/score-picker';
import { usePortalRatings } from '@/features/rating/hooks/use-portal-ratings';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { RATING_SUBSCORE_KEYS, RatingSubscoreKey } from '@/shared/const/rating.const';

type Subscores = Partial<Record<RatingSubscoreKey, number>>;

/**
 * Asked once, at the end, and never again.
 *
 * Shown only when a care plan has completed — a patient three days post-op is rating their pain,
 * not their care. There is no push and no email behind it: this waits in the portal for a patient
 * who chooses to open it, which is the difference between asking and chasing.
 */
export function PortalRatingCard() {
  const t = useTranslations('rating');
  const { ratable, isLoading, isSaving, hasError, submitted, submit } = usePortalRatings();

  const [doctorScore, setDoctorScore] = useState<number | null>(null);
  const [clinicScore, setClinicScore] = useState<number | null>(null);
  const [subscores, setSubscores] = useState<Subscores>({});
  const [comment, setComment] = useState('');
  const [showDetail, setShowDetail] = useState(false);

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
    await submit({
      procedureId: target.procedureId,
      doctorScore,
      clinicScore,
      subscores,
      comment: comment.trim(),
    });
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

        {/* The detail questions are folded away: two answers is a complete rating, and a form
            that opens with six of them is a form most patients close. */}
        {showDetail ? (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            {RATING_SUBSCORE_KEYS.map(key => (
              <ScorePicker
                key={key}
                label={t(`subscore_${key}`)}
                value={subscores[key] ?? null}
                onChange={score => setSubscores(current => ({ ...current, [key]: score }))}
                describeScore={score => t('scoreOf', { score })}
              />
            ))}
          </div>
        ) : (
          <Button variant="ghost" className="self-start px-0" onClick={() => setShowDetail(true)}>
            {t('addDetail')}
          </Button>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="rating-comment">
            {t('comment')}
          </label>
          <Textarea
            id="rating-comment"
            value={comment}
            maxLength={2000}
            placeholder={t('commentPlaceholder')}
            onChange={event => setComment(event.target.value)}
          />
        </div>

        {hasError && <p className="text-sm text-destructive">{t('saveFailed')}</p>}

        <Button disabled={!canSubmit} onClick={() => void handleSubmit()} className="self-start">
          {t('submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
