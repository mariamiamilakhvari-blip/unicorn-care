'use client';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Metrics } from '@/features/analytics/components/analytics-metrics';
import { useAnalytics } from '@/features/analytics/hooks/use-analytics';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { QUARTERS } from '@/shared/const/analytics.const';

/** Four years back is as far as a quarterly comparison stays useful for a product this age. */
const YEAR_SPAN = 4;

export function AnalyticsCard() {
  const t = useTranslations('analytics');
  const tCommon = useTranslations('common');
  const {
    clinics,
    clinicId,
    setClinicId,
    year,
    setYear,
    quarter,
    setQuarter,
    analytics,
    isLoading,
    isSending,
    sentTo,
    error,
    sendReport,
  } = useAnalytics();

  const thisYear = new Date().getUTCFullYear();
  const years = Array.from({ length: YEAR_SPAN }, (_, index) => thisYear - index);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('help')}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={clinicId} onValueChange={setClinicId}>
            <SelectTrigger className="w-full" aria-label={t('clinic')}>
              <SelectValue placeholder={t('clinic')} />
            </SelectTrigger>
            <SelectContent>
              {clinics.map(clinic => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={value => setYear(Number(value))}>
            <SelectTrigger className="w-full" aria-label={t('year')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(option => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(quarter)} onValueChange={value => setQuarter(Number(value))}>
            <SelectTrigger className="w-full" aria-label={t('quarter')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map(option => (
                <SelectItem key={option} value={String(option)}>
                  Q{option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{t(`error.${error}`)}</p>}
        {sentTo && <p className="text-sm font-medium text-moss">{t('sentTo', { email: sentTo })}</p>}

        {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

        {!isLoading && analytics && <Metrics analytics={analytics} />}

        {!isLoading && analytics && (
          <Button
            type="button"
            className="gap-2 self-start"
            disabled={isSending}
            onClick={() => void sendReport()}
          >
            <Send className="size-4" aria-hidden />
            {isSending ? tCommon('loading') : t('sendReport')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
