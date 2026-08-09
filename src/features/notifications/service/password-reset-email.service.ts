import {
  button,
  muted,
  paragraph,
  section,
  shell,
  toPlainText,
} from '@/features/notifications/service/email-layout.service';
import { EmailClinic } from '@/features/notifications/types/email.types';
import { APP_NAME } from '@/shared/const/app.const';
import { emailCopy } from '@/shared/const/email-copy.const';
import { resendClient } from '@/shared/lib/resend-client';
import { AppLocale } from '@/shared/types/roles';

/**
 * The email footer expects a clinic, and a password reset has none: the platform is writing to a
 * person about their own login, not a clinic writing to its patient. Passing the platform in the
 * clinic's place keeps the one shell — with the footer note swapped, because the standard line
 * claims the message came from your clinic and here that would be false.
 */
const PLATFORM_SENDER: EmailClinic = {
  name: APP_NAME,
  addressLine: '',
  phone: '',
  email: '',
  timezone: 'UTC',
};

type PasswordResetEmailInput = {
  to: string;
  locale: AppLocale;
  resetUrl: string;
  ttlMinutes: number;
};

/**
 * Sends one password reset link.
 *
 * Returns a boolean rather than throwing, and the caller ignores it on purpose: the request
 * endpoint answers the same way whether or not an email went out, because an endpoint that fails
 * loudly for unknown addresses is an endpoint that tells a stranger which addresses have accounts.
 * A send failure is logged so the reason is recoverable from the server logs.
 */
export async function sendPasswordResetEmailService(
  input: PasswordResetEmailInput
): Promise<boolean> {
  try {
    if (!resendClient.isConfigured()) return false;

    const copy = emailCopy(input.locale);
    /* One override, not a second copy table: everything but the footer line is already right. */
    const platformCopy = { ...copy, footerNote: copy.resetFooterNote };
    const expiry = copy.resetExpiry.replace('{minutes}', String(input.ttlMinutes));

    const sections = [
      section('🔑', copy.resetHeadline, paragraph(copy.resetIntro)),
      section('', copy.resetCta, button(copy.resetCta, input.resetUrl)),
      section('', '', [muted(expiry), muted(copy.resetIgnore)].join('')),
    ].join('');

    const lines = [copy.resetIntro, '', input.resetUrl, '', expiry, copy.resetIgnore];

    const result = await resendClient.send({
      to: input.to,
      subject: copy.resetSubject,
      html: shell(copy.resetHeadline, sections, PLATFORM_SENDER, platformCopy),
      text: toPlainText(copy.resetHeadline, lines, PLATFORM_SENDER, platformCopy),
    });

    if (!result.ok) {
      // The address is not logged: it is the one piece of this that identifies a person.
      console.error('[email] password reset failed', result.statusCode, result.message);
      return false;
    }
    return true;
  } catch (caught) {
    console.error('[email] password reset threw', caught);
    return false;
  }
}
