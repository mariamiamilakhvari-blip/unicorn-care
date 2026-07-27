import { randomBytes } from 'crypto';

import { Types } from 'mongoose';

import { pushSubscriptionRepository } from '@/features/notifications/repository/push-subscription.repository';
import { patientAccessTokenRepository } from '@/features/patient/repository/patient-access-token.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import {
  AccessLinkResult,
  AccessRevokeResult,
  PatientAccessGrant,
} from '@/features/patient/types/patient.types';
import { PATIENT_PORTAL_ROUTE } from '@/shared/const/routes.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';
import { hashPassword } from '@/shared/utils/password';

const TOKEN_BYTES = 32;
export const TOKEN_TTL_DAYS = 90;

/**
 * PRD 02 §B "Issuing". 32 random bytes → base64url is the raw token; only its SHA-256 is stored,
 * so a database read yields no working links. Prior tokens are revoked *before* the new row is
 * written — revoking afterwards would match and kill the token we just issued.
 */
export async function issueTokenService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<AccessLinkResult>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const now = clock.now();
  await patientAccessTokenRepository.revokeAllForPatient(patientId, clinicId, now);

  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = clock.addDays(now, TOKEN_TTL_DAYS);

  await patientAccessTokenRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: new Types.ObjectId(clinicId),
    tokenHash: hashPassword(rawToken),
    expiresAt,
    revokedAt: null,
    lastUsedAt: null,
  });

  return {
    data: {
      url: `${process.env.NEXTAUTH_URL}${PATIENT_PORTAL_ROUTE}/${rawToken}`,
      expiresAt: expiresAt.toISOString(),
    },
    status: 201,
  };
}

/**
 * PRD 02 §B "Redeeming". Every rejection returns the same 401 so the endpoint cannot be used to
 * distinguish an unknown token from a revoked or expired one.
 */
export async function redeemTokenService(
  rawToken: string
): Promise<ServiceResult<PatientAccessGrant>> {
  const token = await patientAccessTokenRepository.findByTokenHash(hashPassword(rawToken));
  if (!token) return { data: { error: 'INVALID_TOKEN' }, status: 401 };
  // Truthy check, not `!== null`: the field is nullable *and* optional in the inferred type.
  if (token.revokedAt) return { data: { error: 'INVALID_TOKEN' }, status: 401 };

  const now = clock.now();
  if (token.expiresAt.getTime() <= now.getTime()) {
    return { data: { error: 'INVALID_TOKEN' }, status: 401 };
  }

  const patientId = token.patientId.toString();
  const clinicId = token.clinicId.toString();

  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'INVALID_TOKEN' }, status: 401 };

  await patientAccessTokenRepository.touchLastUsed(token._id.toString(), now);

  return { data: { patientId, clinicId, locale: patient.locale }, status: 200 };
}

/**
 * PRD 02 §B "Revoking". Push subscriptions die with the link — otherwise a revoked patient would
 * keep receiving reminders they can no longer open.
 */
export async function revokeAccessService(
  clinicId: string,
  patientId: string
): Promise<ServiceResult<AccessRevokeResult>> {
  const patient = await patientRepository.findById(patientId, clinicId);
  if (!patient) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const revokedTokens = await patientAccessTokenRepository.revokeAllForPatient(
    patientId,
    clinicId,
    clock.now()
  );
  const deactivatedSubscriptions =
    await pushSubscriptionRepository.deactivateAllForPatient(patientId);

  return { data: { revokedTokens, deactivatedSubscriptions }, status: 200 };
}
