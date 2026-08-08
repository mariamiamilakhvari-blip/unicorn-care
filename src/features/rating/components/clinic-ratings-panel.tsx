'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { RatingRow } from '@/features/rating/components/rating-row';
import { useClinicRatings } from '@/features/rating/hooks/use-clinic-ratings';
import { ClinicRatingSummary } from '@/features/rating/types/rating.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

/**
 * The clinic's standing, and every rating behind it.
 *
 * Below `MIN_RATINGS_FOR_AVERAGE` no average is shown at all. One unhappy patient is not a 2.0
 * clinic and one happy patient is not a 5.0 clinic; printing either number would tell a clinic
 * something untrue about itself, and the individual ratings underneath say more anyway.
 */
function Summary({ summary }: { summary: ClinicRatingSummary }) {
  const t = useTranslations('rating');

  if (summary.belowThreshold) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t('notEnough')}</p>
        <p className="text-xs text-muted-foreground">
          {t('notEnoughHelp', { count: summary.ratingCount, threshold: summary.threshold })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-8">
      <Average label={t('doctorAverage')} value={summary.avgDoctorScore} />
      <Average label={t('clinicAverage')} value={summary.avgClinicScore} />
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{t('ratingCount')}</p>
        <p className="font-heading text-2xl font-semibold">{summary.ratingCount}</p>
      </div>
    </div>
  );
}

function Average({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex items-center gap-2 font-heading text-2xl font-semibold">
        <Star className="size-5 fill-current text-moss" aria-hidden />
        {value?.toFixed(1)}
      </p>
    </div>
  );
}

export function ClinicRatingsPanel() {
  const t = useTranslations('rating');
  const tCommon = useTranslations('common');
  const { data, isLoading, hasError, respond } = useClinicRatings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('clinicTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('clinicHelp')}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}
        {hasError && <p className="text-sm text-muted-foreground">{tCommon('error')}</p>}

        {data && (
          <>
            <Summary summary={data.summary} />
            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('none')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.items.map(rating => (
                  <RatingRow key={rating.id} rating={rating} onRespond={respond} />
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
