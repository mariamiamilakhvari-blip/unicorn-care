export type AssistantTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantReply = {
  content: string;
  /** True when the model was unreachable and the patient got the fallback instead. */
  isFallback: boolean;
};
