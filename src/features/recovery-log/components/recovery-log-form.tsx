'use client';

import { CircleCheck, ImagePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { PainScale } from '@/features/recovery-log/components/pain-scale';
import { useRecoveryLog } from '@/features/recovery-log/hooks/use-recovery-log';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  MAX_PHOTOS_PER_LOG,
  MOOD_LEVELS,
  MoodLevel,
  SWELLING_LEVELS,
  SwellingLevel,
} from '@/shared/const/recovery-log.const';
import { cn } from '@/shared/lib/utils';

type ChoiceProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (choice: T) => void;
  render: (option: T) => string;
};

function ChoiceRow<T extends string>({ label, options, value, onChange, render }: ChoiceProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-md border px-3 py-2 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === option
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
            )}
          >
            {render(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The patient's daily check-in.
 *
 * Pain and swelling are required and everything else is optional, because two answers is a usable
 * point on the curve and a form demanding four is one fewer people finish. Nothing here is
 * clinical advice and nothing is scored — it records what the patient says, and the clinic reads
 * the shape over time.
 */
export function RecoveryLogForm() {
  const t = useTranslations('recoveryLog');
  const { today, todayIndex, isLoading, isSaving, hasError, submit, uploadPhoto } =
    useRecoveryLog();

  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [swelling, setSwelling] = useState<SwellingLevel | null>(null);
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [note, setNote] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // No active plan means no recovery to report on, and no day to file the entry against.
  if (isLoading || todayIndex < 0) return null;

  if (today) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <CircleCheck className="size-6 shrink-0 text-moss" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t('alreadyLogged')}</p>
            <p className="text-xs text-muted-foreground">
              {t('alreadyLoggedHelp', { pain: today.painLevel })}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoFailed(false);
    const id = await uploadPhoto(file);
    if (id) setPhotoIds(current => [...current, id]);
    else setPhotoFailed(true);
  }

  async function handleSubmit() {
    if (painLevel === null || swelling === null) return;
    await submit({ painLevel, swelling, mood, note: note.trim(), photoIds });
  }

  const canSubmit = painLevel !== null && swelling !== null && !isSaving;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('dayLabel', { day: todayIndex })}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <PainScale
          value={painLevel}
          onChange={setPainLevel}
          label={t('pain')}
          lowLabel={t('painLow')}
          highLabel={t('painHigh')}
        />

        <ChoiceRow
          label={t('swelling')}
          options={SWELLING_LEVELS}
          value={swelling}
          onChange={setSwelling}
          render={option => t(`swelling_${option}`)}
        />

        <ChoiceRow
          label={t('mood')}
          options={MOOD_LEVELS}
          value={mood}
          onChange={setMood}
          render={option => t(`mood_${option}`)}
        />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="recovery-note">
            {t('note')}
          </label>
          <Textarea
            id="recovery-note"
            value={note}
            maxLength={2000}
            placeholder={t('notePlaceholder')}
            onChange={event => setNote(event.target.value)}
          />
        </div>

        {/* The consent line is shown before the picker opens, not after the file is chosen —
            agreeing to it is what the upload is authorised by. */}
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">{t('photos')}</p>
          <p className="text-xs text-muted-foreground">{t('photoConsent')}</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={event => void handlePhoto(event.target.files?.[0])}
          />
          <Button
            variant="outline"
            className="self-start"
            disabled={photoIds.length >= MAX_PHOTOS_PER_LOG}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            {t('addPhoto')}
          </Button>
          {photoIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('photosAttached', { count: photoIds.length })}
            </p>
          )}
          {photoFailed && <p className="text-xs text-destructive">{t('photoFailed')}</p>}
        </div>

        {hasError && <p className="text-sm text-destructive">{t('saveFailed')}</p>}

        <Button disabled={!canSubmit} onClick={() => void handleSubmit()} className="self-start">
          {t('submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
