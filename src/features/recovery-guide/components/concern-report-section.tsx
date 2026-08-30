'use client';

import { CircleCheck, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useConcernReport } from '@/features/recovery-guide/hooks/use-concern-report';
import { WarningItemView } from '@/features/recovery-guide/types/recovery-guide.types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  CONTACT_METHODS,
  ContactMethod,
  DEFAULT_CONTACT_METHOD,
} from '@/shared/const/recovery.const';
import { cn } from '@/shared/lib/utils';

/** Long enough for a paragraph, short of an essay nobody will read on a phone. */
const MAX_LENGTH = 1000;

/** Matches the cap in `CreateSymptomReportSchema` — the server is the one that enforces it. */
const MAX_PHONE_LENGTH = 40;

type ConcernReportSectionProps = {
  /** The clinic's own warning signs, offered as one-tap choices. Empty when no guide exists. */
  warnings: WarningItemView[];
  /** The number on the patient's record. Offered as the default, never forced. */
  patientPhone: string;
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
export function ConcernReportSection({ warnings, patientPhone }: ConcernReportSectionProps) {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const { isSending, justSent, error, send } = useConcernReport();

  const [selected, setSelected] = useState<WarningItemView | null>(null);
  const [note, setNote] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>(DEFAULT_CONTACT_METHOD);
  /*
    Seeded from the record so the common case is one glance and no typing, and editable because
    the uncommon case is the whole point of the field: a patient recovering abroad is on a SIM the
    clinic has never seen, and the number on file reaches a phone in a drawer at home.
  */
  const [contactPhone, setContactPhone] = useState(patientPhone);

  const hasContent = Boolean(selected) || note.trim().length > 0;

  async function submit() {
    const sent = await send({
      warningTitle: selected?.title ?? '',
      severity: selected?.severity ?? '',
      note,
      contactMethod,
      /*
        An untouched field sends nothing rather than a copy of the record. The server falls back to
        the patient's own number, which keeps the report in step with the record if the clinic
        later corrects it — see `resolveContactPhone`.
      */
      contactPhone: contactPhone.trim() === patientPhone.trim() ? '' : contactPhone,
    });

    // Only on success: clearing after a failure throws away text the patient has already typed
    // once, when they are most worried and least likely to want to type it again.
    if (!sent) return;
    setSelected(null);
    setNote('');
    /*
      The contact preference is deliberately *not* reset. A patient abroad is still abroad for the
      next report, and making them re-pick WhatsApp and re-type an international number every time
      is how the field stops being used at all.
    */
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

      {/*
        Below the note, above the button. It is a detail about the reply, not about the symptom —
        a patient scrolling to the send button reads it on the way past, and nobody has to answer
        it before they can describe what is wrong.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="concern-contact-method" className="text-xs">
            {t('contactMethodLabel')}
          </Label>
          <Select
            value={contactMethod}
            onValueChange={value => setContactMethod(value as ContactMethod)}
          >
            <SelectTrigger id="concern-contact-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_METHODS.map(method => (
                <SelectItem key={method} value={method}>
                  {t(`contactMethod.${method}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="concern-contact-phone" className="text-xs">
            {t('contactPhoneLabel')}
          </Label>
          <Input
            id="concern-contact-phone"
            type="tel"
            inputMode="tel"
            maxLength={MAX_PHONE_LENGTH}
            value={contactPhone}
            onChange={event => setContactPhone(event.target.value)}
            placeholder={t('contactPhonePlaceholder')}
          />
          {/*
            Said here rather than discovered by the clinic: a number without a country code is
            indistinguishable from one with a different country's code, and the clinic cannot tell
            which they are holding.
          */}
          <p className="text-xs text-muted-foreground">{t('contactPhoneHelp')}</p>
        </div>
      </div>

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
