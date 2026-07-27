export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatResult =
  | { ok: true; content: string }
  | { ok: false; statusCode: number; reason: 'rate_limited' | 'unauthorized' | 'upstream' };

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b:free';
const REQUEST_TIMEOUT_MS = 30_000;

/** Low temperature on purpose: this assistant restates a care plan, it does not brainstorm. */
const TEMPERATURE = 0.2;
const MAX_TOKENS = 800;

/**
 * The default model (`openai/gpt-oss-20b`) is a reasoning model: left alone it spends the whole
 * token budget on a `reasoning` field and returns `content: null` with `finish_reason: 'length'`.
 * Excluding reasoning and keeping effort low is what makes it answer at all — verified against the
 * live API. Harmless on non-reasoning models, which ignore the field.
 */
const REASONING = { effort: 'low', exclude: true } as const;

type OpenRouterChoice = { message?: { content?: string | null }; finish_reason?: string };
type OpenRouterResponse = { choices?: OpenRouterChoice[] };

/**
 * Server-only wrapper around the OpenRouter chat-completions API.
 *
 * Never throws — a failed call returns the failure shape so the assistant degrades into "ask your
 * clinic" rather than a 500. An LLM being down must never look like the app being broken to a
 * post-op patient.
 */
class OpenRouterClient {
  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { ok: false, statusCode: 0, reason: 'unauthorized' };

    const baseUrl = process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL;
    const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          reasoning: REASONING,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) return this.toFailure(response.status);

      const payload: OpenRouterResponse = await response.json();
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) return { ok: false, statusCode: response.status, reason: 'upstream' };

      return { ok: true, content };
    } catch {
      return { ok: false, statusCode: 0, reason: 'upstream' };
    }
  }

  private toFailure(statusCode: number): ChatResult {
    if (statusCode === 401 || statusCode === 403) {
      return { ok: false, statusCode, reason: 'unauthorized' };
    }
    if (statusCode === 429) return { ok: false, statusCode, reason: 'rate_limited' };
    return { ok: false, statusCode, reason: 'upstream' };
  }
}

export const openRouterClient = new OpenRouterClient();
export { OpenRouterClient };
