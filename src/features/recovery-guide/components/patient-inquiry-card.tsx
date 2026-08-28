'use client';

import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { usePatientInquiry } from '@/features/recovery-guide/hooks/use-patient-inquiry';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';

/** Long enough for a paragraph, short of an essay the clinic will not read on a phone. */
const MAX_LENGTH = 1000;

/**
 * Where a patient writes to their clinic about something the guide does not cover.
 *
 * The portal already had a free-text box, behind the red "something doesn't feel right" button.
 * That button is an alarm, and it reads as one — which is right for a symptom and wrong for
 * everything else. A patient wondering whether they may shower, or whether the swelling they have
 * is the swelling they were told to expect, will not press it, and the question goes unasked or
 * arrives by phone during a consultation. This is the same channel with a door they will open.
 *
 * The field is on the page rather than behind a toggle, for the same reason. Somebody who does not
 * already know this exists has to be able to see that they can write in.
 *
 * It goes to the one review queue the alarm goes to, which is the whole point of routing it
 * through the existing report rather than inventing a second inbox: two queues means one of them
 * gets read late, and a patient cannot know which one they picked.
 */
export function PatientInquiryCard() {
  const t = useTranslations('recoveryGuide');
  const tCommon = useTranslations('common');
  const { isSending, sentAt, error, send, reset } = usePatientInquiry();
  const [note, setNote] = useState('');

  async function submit() {
    await send(note);
    setNote('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4 text-primary" aria-hidden />
          {t('inquiryTitle')}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {sentAt ? (
          /*
            Confirmed and then reopened, rather than a form that keeps a sent message in it. A
            patient who has just written in is told it arrived; one who thinks of something else
            gets the box back without reloading the portal.
          */
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm font-medium text-moss">{t('inquirySent')}</p>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              {t('inquiryWriteAnother')}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t('inquiryHelp')}</p>

            <Textarea
              rows={4}
              maxLength={MAX_LENGTH}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder={t('inquiryPlaceholder')}
              aria-label={t('inquiryTitle')}
            />

            <Button
              type="button"
              disabled={isSending || note.trim().length === 0}
              onClick={() => void submit()}
              className="self-start"
            >
              {isSending ? tCommon('loading') : t('inquirySubmit')}
            </Button>

            {/*
              Says the message did not send, which is the only thing the patient can act on — and
              it matters here more than on most forms, because somebody who believes their clinic
              has been told may then wait instead of ringing.
            */}
            {error && <p className="text-sm font-medium text-destructive">{t('inquiryFailed')}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
