import { randomBytes } from 'crypto';

import { Types } from 'mongoose';

import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import {
  AccessLinkResult,
  AccessRevokeResult,
  PatientAccessGrant,
} from '@/features/patient/types/patient.types';
import { PATIENT_PORTAL_ROUTE } from '@/shared/const/routes.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';
import { linkOrigin } from '@/shared/utils/link-origin';
import { hashPassword } from '@/shared/utils/password';

const TOKEN_BYTES = 32;

/**
 * A correlation handle for the logs. The first bytes of the *hash*, never the token: it is enough
 * to follow one link from issue to redemption across log lines, and it cannot be turned back into
 * anything that opens a portal.
 */
export function tokenTag(rawToken: string): string {
  return hashPassword(rawToken).slice(0, 8);
}

/**
 * Writes a durable access token and hands back the raw value, which exists nowhere else.
 *
 * Shared by the staff-issued link and by the redemption of an emailed portal link, so both arrive
 * at a session the same way — one place decides what an access token is.
 */
export async function mintAccessToken(patientId: string, clinicId: string): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');

  await patientAccessTokenRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: new Types.ObjectId(clinicId),
    tokenHash: hashPassword(rawToken),
    revokedAt: null,
    lastUsedAt: null,
  });

  console.warn('[patient-access] issued', { patientId, clinicId, token: tokenTag(rawToken) });
  return rawToken;
}

/**
 * PRD 02 §B "Issuing". 32 random bytes → base64url is the raw token; only its SHA-256 is stored,
 * so a database read yields no working links.
 *
 * Issuing is purely additive: it does not expire, and it does not revoke what came before. A
 * patient keeps whichever link they still have — the one in the first email, the one a relative
 * forwarded them — for their whole rehabilitation, and a clinic re-issuing a link for one patient
 * cannot lock that patient out of the copy they were already using.
 *
 * The consequence is that live links accumulate, one per issue, all equally valid. Revocation is
 * the only way any of them ends, and `revokeAccessService` deliberately ends all of them at once:
 * a clinic that revokes because a link leaked means every outstanding link, not the newest.
 */
export async function issueTokenService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<AccessLinkResult>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const rawToken = await mintAccessToken(patientId, clinicId);

  return {
    data: { url: `${linkOrigin()}${PATIENT_PORTAL_ROUTE}/${rawToken}` },
    status: 201,
  };
}

/**
 * PRD 02 §B "Redeeming". Every rejection returns the same 401 so the endpoint cannot be used to
 * distinguish an unknown token from a revoked one.
 */
export async function redeemTokenService(
  rawToken: string
): Promise<ServiceResult<PatientAccessGrant>> {
  /*
    The caller gets one undifferentiated 401; the log gets the reason. Which of these fired is the
    difference between "the clinic revoked this", "this link was never ours" and "the patient
    record is gone", and without it every one of them looked identical from the outside.
  */
  const tag = tokenTag(rawToken);

  const token = await patientAccessTokenRepository.findByTokenHash(hashPassword(rawToken));
  if (!token) {
    console.warn('[patient-access] rejected: unknown token', { token: tag });
    return { data: { error: 'INVALID_TOKEN' }, status: 401 };
  }
  // Truthy check, not `!== null`: the field is nullable *and* optional in the inferred type.
  if (token.revokedAt) {
    console.warn('[patient-access] rejected: revoked token', { token: tag });
    return { data: { error: 'INVALID_TOKEN' }, status: 401 };
  }

  const now = clock.now();

  const patientId = token.patientId.toString();
  const clinicId = token.clinicId.toString();

  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) {
    console.warn('[patient-access] rejected: patient not found', { token: tag, patientId });
    return { data: { error: 'INVALID_TOKEN' }, status: 401 };
  }

  await patientAccessTokenRepository.touchLastUsed(token._id.toString(), now);

  return { data: { patientId, clinicId, locale: patient.locale }, status: 200 };
}

/**
 * PRD 02 §B "Revoking". Push subscriptions die with the link — otherwise a revoked patient would
 * keep receiving reminders they can no longer open.
 *
 * The unspent portal links in the patient's inbox die with it too. Every notification email now
 * carries one, and each is a standing offer to mint a fresh access token — so revoking only the
 * tokens would leave a month of reminders in that mailbox, any one of which hands back exactly the
 * access the clinic just withdrew.
 */
export async function revokeAccessService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<AccessRevokeResult>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const now = clock.now();

  const revokedTokens = await patientAccessTokenRepository.revokeAllForPatient(
    patientId,
    clinicId,
    now
  );

  await patientPortalLinkRepository.markAllUsedForPatient(patientId, now);

  const deactivatedSubscriptions =
    await pushSubscriptionRepository.deactivateAllForPatient(patientId);

  return { data: { revokedTokens, deactivatedSubscriptions }, status: 200 };
}
