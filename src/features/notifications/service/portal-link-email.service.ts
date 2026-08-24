import {
  button,
  muted,
  paragraph,
  section,
  shell,
  toPlainText,
} from '@/features/notifications/service/email-layout.service';
import { EmailClinic } from '@/features/notifications/types/email.types';
import { emailCopy } from '@/shared/const/email-copy.const';
import { EmailCopy } from '@/shared/const/email-copy.types';
import { resendClient } from '@/shared/lib/resend-client';
import { AppLocale } from '@/shared/types/roles';

type PortalLinkEmailInput = {
  to: string;
  locale: AppLocale;
  clinic: EmailClinic;
  portalUrl: string;
  ttlHours: number;
};

/** Two days, below which a window is still something a person counts in hours. */
const DAYS_THRESHOLD_HOURS = 48;

/**
 * States the link's lifetime in the unit a person would use for it.
 *
 * A month-long link rendered through the hours string reads "stops working after 720 hours",
 * which is true and tells the patient nothing — nobody converts that in their head. The requested
 * link is a day long and reads correctly as hours, so the unit follows the window rather than
 * being fixed for both.
 */
function expiryLine(copy: EmailCopy, ttlHours: number): string {
  if (ttlHours >= DAYS_THRESHOLD_HOURS && ttlHours % 24 === 0) {
    return copy.portalLinkExpiryDays.replace('{days}', String(ttlHours / 24));
  }
  return copy.portalLinkExpiry.replace('{hours}', String(ttlHours));
}

/**
 * Sends one patient a way back into their portal.
 *
 * The only patient email that carries a token, and the reason the others do not have to: a routine
 * email is a standing credential in an inbox forever, whereas this one is asked for, expires, and
 * is spent the moment it is used.
 *
 * Returns a boolean the caller ignores, matching the password reset: the request endpoint must
 * answer identically whether or not a message went out, or the difference is a way to ask the
 * platform which addresses belong to real patients. A failure is logged so the reason survives.
 */
export async function sendPortalLinkEmailService(input: PortalLinkEmailInput): Promise<boolean> {
  try {
    if (!resendClient.isConfigured()) {
      console.error('[email] portal link skipped: Resend is not configured');
      return false;
    }

    const copy = emailCopy(input.locale);
    const expiry = expiryLine(copy, input.ttlHours);

    const sections = [
      section('🔗', copy.portalLinkHeadline, paragraph(copy.portalLinkIntro)),
      section('', copy.portalLinkCta, button(copy.portalLinkCta, input.portalUrl)),
      section('', '', [muted(expiry), muted(copy.portalLinkIgnore)].join('')),
    ].join('');

    const lines = [copy.portalLinkIntro, '', input.portalUrl, '', expiry, copy.portalLinkIgnore];

    const result = await resendClient.send({
      to: input.to,
      subject: copy.portalLinkSubject,
      html: shell(copy.portalLinkHeadline, sections, input.clinic, copy),
      text: toPlainText(copy.portalLinkHeadline, lines, input.clinic, copy),
    });

    if (!result.ok) {
      // The address is not logged: it is the one piece of this that identifies a person.
      console.error('[email] portal link failed', result.statusCode, result.message);
      return false;
    }
    return true;
  } catch (caught) {
    console.error('[email] portal link threw', caught);
    return false;
  }
}
