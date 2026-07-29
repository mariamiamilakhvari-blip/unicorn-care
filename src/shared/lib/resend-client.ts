export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult =
  | { ok: true; id: string }
  | { ok: false; statusCode: number; message: string };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Transactional email through Resend's REST API.
 *
 * Deliberately no SDK: one POST is the whole contract, and a dependency that ships its own fetch
 * polyfill is not worth carrying for it.
 *
 * A patient's clinical detail leaves the system in these bodies, so a send is never fire-and-forget
 * — every call returns a typed result the caller has to look at, and a failure is recorded rather
 * than swallowed. `isConfigured` exists so a deployment missing the key degrades to "no email"
 * instead of throwing inside a cron sweep and taking the push reminders down with it.
 */
class ResendClient {
  private apiKey(): string {
    return process.env.RESEND_API_KEY ?? '';
  }

  private from(): string {
    return process.env.RESEND_FROM ?? 'Unicorn Care <onboarding@resend.dev>';
  }

  isConfigured(): boolean {
    return this.apiKey().length > 0;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      return { ok: false, statusCode: 0, message: 'RESEND_NOT_CONFIGURED' };
    }

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from(),
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        /*
          The common failure in this account is a 403: with no verified domain Resend only accepts
          the account owner's own address. It is surfaced with its message intact so the reason
          reaches the logs rather than appearing as a generic send failure.
        */
        const message = typeof payload?.message === 'string' ? payload.message : 'SEND_FAILED';
        return { ok: false, statusCode: response.status, message };
      }

      const id = typeof payload?.id === 'string' ? payload.id : '';
      return { ok: true, id };
    } catch (caught) {
      return {
        ok: false,
        statusCode: 0,
        message: caught instanceof Error ? caught.message : 'NETWORK_ERROR',
      };
    }
  }
}

export const resendClient = new ResendClient();
