'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { http } from '@/shared/lib/http';

/** How long the "sent" line stays up before the form quietly returns to ready. */
export const CONFIRMATION_MS = 5000;

export type ConcernReportInput = {
  warningTitle: string;
  severity: string;
  note: string;
};

type ConcernReportState = {
  isSending: boolean;
  /** True for a few seconds after a successful send, then clears itself. */
  justSent: boolean;
  error: string | null;
  send: (input: ConcernReportInput) => Promise<boolean>;
};

/**
 * A patient telling their clinic something — a red flag from the guide, a question of their own,
 * or the two together in one message.
 *
 * One channel, because there is one review queue. The portal used to have two ways in with two
 * separate pieces of state, and the older of them latched: once a report was filed the escalation
 * control was replaced by a confirmation for the rest of the session, so a patient whose symptom
 * changed an hour later had no way to say so without reloading the page. That is the failure mode
 * this hook exists to remove — a recovery is days long, and the second thing a patient notices
 * matters as much as the first.
 *
 * The confirmation is therefore a timed state rather than a terminal one. It says the message
 * arrived, holds long enough to be read, and then the form is simply ready again.
 *
 * Returns whether the send succeeded so the form can decide what to clear. Clearing on failure
 * would throw away text a patient has already typed once, at the moment they are most likely to
 * be worried and least likely to want to type it again.
 */
export function useConcernReport(): ConcernReportState {
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A send that resolves after the patient has navigated away must not set state on a dead tree.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const send = useCallback(async (input: ConcernReportInput) => {
    /*
      The API refuses an empty report too — this only avoids the round trip. An empty row costs a
      clinician the time to open a report and find nothing in it, on the one queue whose whole
      purpose is that nothing gets missed.
    */
    if (input.warningTitle.trim().length === 0 && input.note.trim().length === 0) return false;

    setIsSending(true);
    setError(null);
    try {
      await http.post('/patient-portal/symptom-reports', input);

      if (timer.current) clearTimeout(timer.current);
      setJustSent(true);
      timer.current = setTimeout(() => setJustSent(false), CONFIRMATION_MS);

      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
      return false;
    } finally {
      setIsSending(false);
    }
  }, []);

  return { isSending, justSent, error, send };
}
