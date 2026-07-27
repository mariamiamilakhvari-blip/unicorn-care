import { z } from 'zod';

import {
  ASSISTANT_MAX_HISTORY_MESSAGES,
  ASSISTANT_MAX_QUESTION_LENGTH,
} from '@/shared/const/assistant.const';

const TurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(ASSISTANT_MAX_QUESTION_LENGTH),
});

/**
 * History comes from the client, so it is untrusted input, not a transcript we can rely on. It is
 * capped and length-bounded here, and the system prompt is always re-prepended server-side — a
 * client cannot smuggle in its own system role.
 */
export const AskAssistantSchema = z.object({
  question: z.string().min(1).max(ASSISTANT_MAX_QUESTION_LENGTH),
  history: z.array(TurnSchema).max(ASSISTANT_MAX_HISTORY_MESSAGES).default([]),
});

export type AskAssistantType = z.infer<typeof AskAssistantSchema>;
