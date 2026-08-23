import { randomBytes } from 'crypto';

import { Types } from 'mongoose';

import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { sendPortalLinkEmailService } from '@/features/notifications/service/portal-link-email.service';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { mintAccessToken, tokenTag } from '@/features/patient/service/patient-access.service';
import { PortalLinkRequestType } from '@/features/patient/validations/portal-link.validation';
import { PATIENT_PORTAL_ROUTE, PORTAL_LOGIN_ROUTE } from '@/shared/const/routes.const';
import { SITE_URL } from '@/shared/const/seo.const';
import { DEFAULT_TIMEZONE } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';
import { hashPassword } from '@/shared/utils/password';

const TOKEN_BYTES = 32;

const MS_PER_MINUTE = 60 * 1000;

/**
 * How long the link a patient explicitly asked for stays alive.
 *
 * Longer than the staff password reset, because the recipient is a post-operative patient who may
 * not reach their phone for a while, and short enough that the message is not a standing key to a
 * medical record. The durable credential is the cookie this link sets, never the link itself.
 */
export const PORTAL_LINK_TTL_MINUTES = 24 * 60;

/**
 * How long the link carried by an ordinary notification email stays alive.
 *
 * Longer than a requested one because nobody is waiting by their phone for it: it is the way back
 * in from the reminder that happened to be in the inbox when the patient picked up a new device,
 * opened the mail app's in-app browser, or cleared their cookies. A day-long window would mean the
 * portal is reachable only from the newest email, which is the lockout this replaced.
 *
 * Still bounded, and still single-use, so an old message stops being a door once it is walked
 * through or the month is out — the schema's TTL index then deletes the row.
 */
export const NOTIFICATION_LINK_TTL_MINUTES = 30 * 24 * 60;

const linkOrigin = (): string => process.env.NEXTAUTH_URL || SITE_URL;

/**
 * Writes one single-use portal link and returns the URL to put in an email.
 *
 * Shared by the requested link and by the call to action on every notification email, so both are
 * the same kind of credential with the same lifecycle — one place decides what an emailed link is.
 *
 * Issuing does **not** spend the patient's other outstanding links. Each email carries its own, and
 * every one of them keeps working until it is used or its window closes: the whole point is that a
 * patient reaching for whichever message is in front of them gets in.
 */
export async function issuePortalLink(
  patientId: string,
  clinicId: Types.ObjectId,
  ttlMinutes: number
): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');

  await patientPortalLinkRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId,
    tokenHash: hashPassword(rawToken),
    expiresAt: new Date(clock.now().getTime() + ttlMinutes * MS_PER_MINUTE),
    usedAt: null,
  });

  console.warn('[portal-link] issued', { patientId, token: tokenTag(rawToken) });

  return `${linkOrigin()}${PORTAL_LOGIN_ROUTE}/${rawToken}`;
}

/**
 * The portal address for one patient's email, and the reason a patient email is worth opening at
 * all on a device that has never redeemed a link.
 *
 * Falls back to the tokenless portal URL rather than failing the send: an email that lands with a
 * link to the "ask for a new link" page is worth far more than an email that never leaves, and
 * that page is the same fallback a patient reaches when a link is finally spent.
 */
export async function portalLinkForEmail(
  patientId: string,
  clinicId: Types.ObjectId
): Promise<string> {
  try {
    return await issuePortalLink(patientId, clinicId, NOTIFICATION_LINK_TTL_MINUTES);
  } catch (caught) {
    console.error('[portal-link] could not mint an email link', patientId, caught);
    return `${linkOrigin()}${PATIENT_PORTAL_ROUTE}`;
  }
}

/**
 * Emails a patient a fresh way into their portal.
 *
 * **Always answers 200.** Known address, unknown address, an address on several records — one
 * response. A patient list is a list of people who have had surgery at a named clinic, so an
 * endpoint that answered differently for a real address would leak exactly that, to anyone with a
 * browser.
 *
 * **Refuses an address that resolves to more than one patient**, and that refusal is the point
 * rather than a limitation worked around. A patient is a clinic's record, not a login, so the same
 * address legitimately sits on several — a parent and child sharing an inbox, one person treated at
 * two clinics on the platform. There are three things this could do with such a request and two of
 * them are breaches:
 *
 *   - Pick one. That is what `findOne` did, and it mints a credential into whichever record the
 *     index yielded — potentially a different person's medical record, at a different clinic.
 *   - Send a link for each. The mailbox then learns how many patients share it and which clinics
 *     hold them, and in the shared-inbox case one family member is handed a working door into the
 *     other's record.
 *   - Send nothing, and say the same thing it says to everyone.
 *
 * The third is the only safe answer, and it is not a dead end: staff issue a link directly from the
 * patient's page, where the record has already been chosen by someone who knows which is which.
 */
export async function requestPortalLinkService(
  input: PortalLinkRequestType
): Promise<ServiceResult<{ message: string }>> {
  const accepted = { data: { message: 'PORTAL_LINK_REQUESTED' }, status: 200 };

  /*
    An address still on the record. A patient whose address was cleared since — by an erasure, or
    by the clinic correcting a typo — is not reachable at it, whatever the row still matches.
  */
  const matched = (await patientRepository.findAllByEmail(input.email)).filter(
    // A type predicate rather than a bare truthiness filter, so `email` is a string from here on
    // and the recipient never needs a cast to be handed to the sender.
    (candidate): candidate is PatientDocument & { email: string } => Boolean(candidate.email)
  );

  // No patient, or one whose address was since cleared: one answer, one log line, no address in it.
  if (matched.length === 0) {
    console.warn('[portal-link] request for an address with no reachable patient');
    return accepted;
  }

  /*
    Ambiguous, so nothing is sent. Logged with the count and never the address, because this line
    is the only way a clinic finds out why a patient says the link never arrives — and because an
    address in a log is a patient's contact detail sitting outside the record it belongs to.
  */
  if (matched.length > 1) {
    console.warn('[portal-link] refused: address is on more than one patient', {
      patients: matched.length,
    });
    return accepted;
  }

  const [patient] = matched;

  const recipient = patient.email;

  const patientId = patient._id.toString();

  /*
    Asking again does not kill the earlier link. Someone who asks twice usually did so because the
    first message was slow, and spending it on issue meant the email that finally arrived was the
    dead one — while every reminder already sitting in the inbox died with it.
  */
  const portalUrl = await issuePortalLink(patientId, patient.clinicId, PORTAL_LINK_TTL_MINUTES);

  /*
    The send result is not surfaced, for the same reason the unknown address is not: a failure that
    read differently from "no such patient" would rebuild the oracle this endpoint avoids. The
    email service logs why.
  */
  const clinic = await clinicRepository.findById(patient.clinicId.toString());

  await sendPortalLinkEmailService({
    to: recipient,
    locale: patient.locale,
    // The email is sent on the clinic's behalf, so its footer carries the clinic a patient would
    // actually call. A missing clinic is not worth failing over — the link still works.
    clinic: {
      name: clinic?.name ?? '',
      addressLine: clinic?.addressLine ?? '',
      phone: clinic?.phone ?? '',
      email: clinic?.email ?? '',
      timezone: clinic?.timezone ?? DEFAULT_TIMEZONE,
    },
    portalUrl,
    ttlHours: PORTAL_LINK_TTL_MINUTES / 60,
  });

  return accepted;
}

/**
 * Spends an emailed link and mints the durable access token behind it.
 *
 * Single use, and *only* the link that was followed. Every notification email carries its own link
 * now, so spending the patient's whole outstanding set here would mean opening today's reminder
 * silently killed every other message in the inbox — the lockout this flow exists to end.
 *
 * The access token that comes out is additive, exactly as a staff-issued one is: a patient still
 * holding a working session on another device keeps it.
 */
export async function redeemPortalLinkService(
  rawToken: string
): Promise<ServiceResult<{ accessToken: string }>> {
  const tag = tokenTag(rawToken);
  const rejected: ServiceResult<{ accessToken: string }> = {
    data: { error: 'INVALID_TOKEN' },
    status: 401,
  };

  const link = await patientPortalLinkRepository.findByTokenHash(hashPassword(rawToken));
  if (!link) {
    console.warn('[portal-link] rejected: unknown link', { token: tag });
    return rejected;
  }
  // Truthy check, not `!== null`: the field is nullable *and* optional in the inferred type.
  if (link.usedAt) {
    console.warn('[portal-link] rejected: already used', { token: tag });
    return rejected;
  }

  const now = clock.now();
  if (link.expiresAt.getTime() <= now.getTime()) {
    console.warn('[portal-link] rejected: expired', { token: tag, expiresAt: link.expiresAt });
    return rejected;
  }

  const patientId = link.patientId.toString();
  const clinicId = link.clinicId.toString();

  // The patient can have been erased in the hours since the link was sent.
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) {
    console.warn('[portal-link] rejected: no such patient', { token: tag, patientId });
    return rejected;
  }

  /*
    The claim is the write, not the `usedAt` check above: two taps on the same link — the ordinary
    behaviour of a mail client prefetching a URL and the patient then following it — must not both
    mint an access token.
  */
  const claimed = await patientPortalLinkRepository.markUsed(link._id.toString(), now);
  if (!claimed) {
    console.warn('[portal-link] rejected: lost the race to spend it', { token: tag });
    return rejected;
  }

  const accessToken = await mintAccessToken(patientId, clinicId);

  console.warn('[portal-link] redeemed', { patientId, token: tag });

  return { data: { accessToken }, status: 200 };
}
