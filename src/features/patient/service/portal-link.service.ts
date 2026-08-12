import { randomBytes } from 'crypto';

import { Types } from 'mongoose';

import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { sendPortalLinkEmailService } from '@/features/notifications/service/portal-link-email.service';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { mintAccessToken, tokenTag } from '@/features/patient/service/patient-access.service';
import { PortalLinkRequestType } from '@/features/patient/validations/portal-link.validation';
import { PORTAL_LOGIN_ROUTE } from '@/shared/const/routes.const';
import { SITE_URL } from '@/shared/const/seo.const';
import { DEFAULT_TIMEZONE } from '@/shared/const/timezone.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';
import { hashPassword } from '@/shared/utils/password';

const TOKEN_BYTES = 32;

const MS_PER_MINUTE = 60 * 1000;

/**
 * How long an emailed portal link stays alive.
 *
 * Longer than the staff password reset, because the recipient is a post-operative patient who may
 * not reach their phone for a while, and short enough that the message is not a standing key to a
 * medical record. The durable credential is the cookie this link sets, never the link itself.
 */
export const PORTAL_LINK_TTL_MINUTES = 24 * 60;

const linkOrigin = (): string => process.env.NEXTAUTH_URL || SITE_URL;

/**
 * Emails a patient a fresh way into their portal.
 *
 * **Always answers 200.** Known address, unknown address, archived patient — one response. A
 * patient list is a list of people who have had surgery at a named clinic, so an endpoint that
 * answered differently for a real address would leak exactly that, to anyone with a browser.
 *
 * An archived patient is skipped. Archiving is how a clinic ends a relationship, and a link that
 * re-opens the record afterwards would make that meaningless.
 */
export async function requestPortalLinkService(
  input: PortalLinkRequestType
): Promise<ServiceResult<{ message: string }>> {
  const accepted = { data: { message: 'PORTAL_LINK_REQUESTED' }, status: 200 };

  const patient = await patientRepository.findByEmail(input.email);
  /*
    No patient, an archived one, or one whose address was since cleared — all one answer, and all
    one log line. Archiving is how a clinic ends a relationship, and a link that re-opened the
    record afterwards would make that meaningless.
  */
  if (!patient || patient.isArchived || !patient.email) {
    console.warn('[portal-link] request for an address with no reachable patient');
    return accepted;
  }

  const recipient = patient.email;

  const now = clock.now();
  const patientId = patient._id.toString();

  /*
    Outstanding requests die before the new one is written, not after — the other order would match
    the row just created and kill the link about to be sent. Asking twice is the ordinary way
    someone abandons a first attempt.
  */
  await patientPortalLinkRepository.markAllUsedForPatient(patientId, now);

  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');

  await patientPortalLinkRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: patient.clinicId,
    tokenHash: hashPassword(rawToken),
    expiresAt: new Date(now.getTime() + PORTAL_LINK_TTL_MINUTES * MS_PER_MINUTE),
    usedAt: null,
  });

  console.warn('[portal-link] issued', { patientId, token: tokenTag(rawToken) });

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
    portalUrl: `${linkOrigin()}${PORTAL_LOGIN_ROUTE}/${rawToken}`,
    ttlHours: PORTAL_LINK_TTL_MINUTES / 60,
  });

  return accepted;
}

/**
 * Spends an emailed link and mints the durable access token behind it.
 *
 * Single use, and every other outstanding request for that patient is spent with it: arriving in
 * the portal is the moment older copies of the invitation stop being needed. The access token that
 * comes out is additive, exactly as a staff-issued one is — a patient still holding a working link
 * on another device keeps it.
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

  // The patient can have been archived in the hours since the link was sent.
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient || patient.isArchived) {
    console.warn('[portal-link] rejected: patient inactive', { token: tag, patientId });
    return rejected;
  }

  await patientPortalLinkRepository.markAllUsedForPatient(patientId, now);
  const accessToken = await mintAccessToken(patientId, clinicId);

  console.warn('[portal-link] redeemed', { patientId, token: tag });

  return { data: { accessToken }, status: 200 };
}
