'use client';

import { useCallback, useState } from 'react';

import { AssistantReply, AssistantTurn } from '@/features/assistant/types/assistant.types';
import { ASSISTANT_MAX_HISTORY_MESSAGES } from '@/shared/const/assistant.const';
import { http } from '@/shared/lib/http';

type AssistantState = {
  turns: AssistantTurn[];
  isPending: boolean;
  error: string | null;
  ask: (question: string) => Promise<void>;
};

export function useAssistant(): AssistantState {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (question: string) => {
      const asked: AssistantTurn = { role: 'user', content: question };
      // Trimmed to the same cap the API enforces, so a long session never sends a rejected body.
      const history = [...turns, asked].slice(-ASSISTANT_MAX_HISTORY_MESSAGES);

      setTurns(current => [...current, asked]);
      setIsPending(true);
      setError(null);

      try {
        const reply = await http.post<AssistantReply>('/patient-portal/assistant', {
          question,
          history: history.slice(0, -1),
        });
        setTurns(current => [...current, { role: 'assistant', content: reply.content }]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
      } finally {
        setIsPending(false);
      }
    },
    [turns]
  );

  return { turns, isPending, error, ask };
}
