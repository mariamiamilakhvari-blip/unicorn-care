'use client';

import { CircleCheck, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useConcernReport } from '@/features/recovery-guide/hooks/use-concern-report';
import { WarningItemView } from '@/features/recovery-guide/types/recovery-guide.types';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';

/** Long enough for a paragraph, short of an essay nobody will read on a phone. */
const MAX_LENGTH = 1000;

type ConcernReportSectionProps = {
  /** The clinic's own warning signs, offered as one-tap choices. Empty when no guide exists. */
  warnings: WarningItemView[];
};

/**
 * The one place a patient tells their clinic something.
 *
 * There were two: an "I have this" button beside every warning sign, and a separate free-text card
 * at the foot of the page. Both wrote the same row to the same review queue, so the split bought
 * nothing and cost a patient the decision of which one their problem was — a choice they are least
 * equipped to make at exactly the moment they need to make it. Worse, a symptom that is on the
 * clinic's list *and* needs a sentence of explanation had no way to be both.
 *
 * So: tap a sign, or write, or do both and send one message carrying the pair. The badge is a
 * toggle rather than an immediate submit, which is what makes "both" possible at all — the old
 * button filed the report the instant it was pressed, with no chance to add a word.
 *
 * One sign at a time, deliberately. A report holds a single `warningTitle`, and the honest way to
 * report two symptoms is two reports the clinician can triage apart, rather than one row with a
 * list in it that reads as a single event.
 *
 * The form never latches. A recovery is days long and the second thing a patient notices matters
 * as much as the first, so the confirmation is timed and the field comes back ready.
 */
export function ConcernReportSection({ warnings }: ConcernReportSectionProps) {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const { isSending, justSent, error, send } = useConcernReport();

  const [selected, setSelected] = useState<WarningItemView | null>(null);
  const [note, setNote] = useState('');

  const hasContent = Boolean(selected) || note.trim().length > 0;

  async function submit() {
    const sent = await send({
      warningTitle: selected?.title ?? '',
      severity: selected?.severity ?? '',
      note,
    });

    // Only on success: clearing after a failure throws away text the patient has already typed
    // once, when they are most worried and least likely to want to type it again.
    if (!sent) return;
    setSelected(null);
    setNote('');
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="size-4 text-primary" aria-hidden />
        {t('concernHeading')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('concernHelp')}</p>

      {warnings.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {warnings.map(item => {
            const isOn = selected?.title === item.title;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => setSelected(isOn ? null : item)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    isOn
                      ? 'border-primary-edge bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  {item.title}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Textarea
        rows={3}
        maxLength={MAX_LENGTH}
        value={note}
        onChange={event => setNote(event.target.value)}
        placeholder={t('concernPlaceholder')}
        aria-label={t('concernHeading')}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={isSending || !hasContent}
          onClick={() => void submit()}
          className="self-start"
        >
          {isSending ? tCommon('loading') : t('concernSubmit')}
        </Button>

        {/*
          Transient, and never a replacement for the form. It says the message arrived and then
          gets out of the way, because the next thing the patient notices deserves the same box.
        */}
        {justSent && !error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-moss" role="status">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            {t('concernSent')}
          </p>
        )}
      </div>

      {/*
        Worth saying plainly: someone who believes their clinic has been told may wait instead of
        ringing.
      */}
      {error && <p className="text-sm font-medium text-destructive">{t('concernFailed')}</p>}
    </section>
  );
}
