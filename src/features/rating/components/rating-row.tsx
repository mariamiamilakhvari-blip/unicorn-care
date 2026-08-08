'use client';

import { Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { RatingView } from '@/features/rating/types/rating.types';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';

type RatingRowProps = {
  rating: RatingView & { patientName: string };
  onRespond: (ratingId: string, response: string) => Promise<boolean>;
};

function Score({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Star className="size-4 fill-current text-moss" aria-hidden />
      <span className="font-medium">{value}</span>
    </span>
  );
}

/**
 * One rating as the clinic sees it.
 *
 * There is no delete control here and no route behind one. A clinic may answer a rating, and its
 * answer sits beside the patient's words rather than over them — a review a clinic can remove is
 * not a review, and the ability to reply is what makes an honest one survivable.
 */
export function RatingRow({ rating, onRespond }: RatingRowProps) {
  const t = useTranslations('rating');
  const format = useFormatter();
  const [draft, setDraft] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleRespond() {
    setIsSaving(true);
    try {
      if (await onRespond(rating.id, draft.trim())) setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{rating.patientName || t('anonymous')}</p>
        <p className="text-xs text-muted-foreground">
          {format.dateTime(new Date(rating.submittedAt), { dateStyle: 'medium' })}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Score label={t('doctorShort')} value={rating.doctorScore} />
        <Score label={t('clinicShort')} value={rating.clinicScore} />
      </div>

      {rating.comment && <p className="text-sm">{rating.comment}</p>}

      {rating.clinicResponse ? (
        <div className="rounded-md border-l-2 border-primary-edge bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground">{t('yourResponse')}</p>
          <p className="text-sm">{rating.clinicResponse}</p>
        </div>
      ) : isOpen ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            maxLength={2000}
            placeholder={t('responsePlaceholder')}
            onChange={event => setDraft(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={draft.trim().length === 0 || isSaving}
              onClick={() => void handleRespond()}
            >
              {t('sendResponse')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
              {t('cancelResponse')}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setIsOpen(true)}>
          {t('respond')}
        </Button>
      )}
    </li>
  );
}
