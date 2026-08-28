'use client';

import { useCallback, useState } from 'react';

import { http } from '@/shared/lib/http';

type PatientInquiryState = {
  isSending: boolean;
  sentAt: number | null;
  error: string | null;
  send: (note: string) => Promise<void>;
  reset: () => void;
};

/**
 * A patient writing to their clinic about something the guide does not cover.
 *
 * Posts to the same endpoint as the red-flag report and lands in the same review queue, on
 * purpose: a clinic that has to watch two inboxes will eventually read one of them late, and the
 * one it reads late will be whichever the patient chose. What differs is the way in, not the
 * destination — the guide's escalation button is for a symptom that frightened somebody, this is
 * for a question, and a patient who has a question will not press a red alarm button to ask it.
 *
 * Its own state rather than a second caller of `useRecoveryGuide`. That hook owns the panel's
 * `reportedAt`, which swaps the escalation button for "your clinic will review it" — so sharing it
 * would make asking a question hide the way to report a symptom, which is exactly backwards.
 */
export function usePatientInquiry(): PatientInquiryState {
  const [isSending, setIsSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (note: string) => {
    /*
      Guarded here as well as in the form, because whitespace is what an accidental submit sends
      and an empty row in a clinical review queue costs a clinician the time to open it and find
      nothing. The API refuses it too — this only avoids the round trip.
    */
    if (note.trim().length === 0) return;

    setIsSending(true);
    setError(null);
    try {
      await http.post('/patient-portal/symptom-reports', {
        warningTitle: '',
        severity: '',
        note,
      });
      setSentAt(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsSending(false);
    }
  }, []);

  /** Lets a patient write a second time without reloading the portal. */
  const reset = useCallback(() => {
    setSentAt(null);
    setError(null);
  }, []);

  return { isSending, sentAt, error, send, reset };
}
