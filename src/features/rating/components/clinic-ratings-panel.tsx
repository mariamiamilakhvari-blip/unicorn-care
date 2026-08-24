'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { RatingRow } from '@/features/rating/components/rating-row';
import { useClinicRatings } from '@/features/rating/hooks/use-clinic-ratings';
import {
  ClinicDoctorRating,
  ClinicRatingSummary,
} from '@/features/rating/types/rating.types';
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

/**
 * Each doctor's own average, which is the question a clinic actually asks of this page.
 *
 * A single house average says whether patients are happy and not with whom. Ordered best first,
 * ties broken by volume, with the count printed beside every figure: unlike the public board this
 * shows an average however few ratings stand behind it, because a clinic reading its own numbers
 * is not being ranked and can weigh two ratings for what they are.
 *
 * Renders nothing until at least one rating names a surgeon — an empty "by doctor" heading reads
 * as a fault rather than as an absence.
 */
function DoctorBreakdown({ doctors }: { doctors: ClinicDoctorRating[] }) {
  const t = useTranslations('rating');

  if (doctors.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">{t('byDoctor')}</p>
      <ul className="flex flex-col gap-1">
        {doctors.map(doctor => (
          <li
            key={doctor.name}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{doctor.name}</p>
              <p className="text-xs text-muted-foreground">
                {t('doctorRatingCount', { count: doctor.ratingCount })}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 font-heading text-lg font-semibold">
              <Star className="size-4 fill-current text-moss" aria-hidden />
              {doctor.avgDoctorScore.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
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
            <DoctorBreakdown doctors={data.doctors} />
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
