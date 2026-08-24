import { randomBytes } from 'crypto';

import { Types } from 'mongoose';

import { passwordResetTokenRepository } from '@/features/auth/repository/password-reset-token.repository';
import { userRepository } from '@/features/auth/repository/user.repository';
import {
  ForgotPasswordType,
  ResetPasswordType,
} from '@/features/auth/validations/auth.validation';
import { sendPasswordResetEmailService } from '@/features/notifications/service/password-reset-email.service';
import { RESET_PASSWORD_ROUTE } from '@/shared/const/routes.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';
import { linkOrigin } from '@/shared/utils/link-origin';
import { hashPassword } from '@/shared/utils/password';

const TOKEN_BYTES = 32;

/**
 * How long a reset link stays alive.
 *
 * An hour is long enough to survive a slow mail queue and someone reading their email on the
 * commute, and short enough that a link left in an inbox is not a standing key to the account.
 */
export const RESET_TOKEN_TTL_MINUTES = 60;

const MS_PER_MINUTE = 60 * 1000;

type RequestInput = ForgotPasswordType & { locale: AppLocale };

/**
 * Issues a reset link for an address, if it belongs to an account.
 *
 * **Always answers 200.** Whether the address is on file, deactivated, or unknown, the caller gets
 * the same body. Anything else turns this endpoint into a membership oracle: a stranger could walk
 * a list of addresses and learn which clinics use the platform, which is exactly the reconnaissance
 * a credential-stuffing run starts with. The cost is that a typo'd address looks like success —
 * which is why the page tells the user to check their inbox rather than claiming an email was sent.
 *
 * Deactivated accounts are skipped. Deactivation is how a clinic revokes a login, and a revoked
 * login that can reset its own password back into existence was never revoked.
 *
 * Accounts created through Google are *not* skipped. They hold no password today, and refusing
 * them would leave someone who has lost access to their Google account with no way back in. The
 * link proves control of the mailbox, which is the same fact Google asserted when the account was
 * made — so the reset stands up a password rather than being turned away.
 */
export async function requestPasswordResetService(
  input: RequestInput
): Promise<ServiceResult<{ message: string }>> {
  const accepted = { data: { message: 'RESET_REQUESTED' }, status: 200 };

  const user = await userRepository.findByEmail(input.email);
  if (!user || !user.isActive) return accepted;

  const now = clock.now();
  const userId = user._id.toString();

  /*
    Outstanding links die before the new one is written, not after — revoking afterwards would
    match the row just created and kill the link the user is about to be sent. Requesting a second
    reset is the ordinary way someone abandons a first one, and both staying live means an old
    email in a compromised mailbox still opens the account.
  */
  await passwordResetTokenRepository.markAllUsedForUser(userId, now);

  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');

  await passwordResetTokenRepository.create({
    userId: new Types.ObjectId(userId),
    tokenHash: hashPassword(rawToken),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * MS_PER_MINUTE),
    usedAt: null,
  });

  /*
    The send result is not surfaced. A failure here must read to the caller exactly like an unknown
    address, or the difference between the two answers is the enumeration hole this endpoint was
    written to avoid. The email service logs the reason.
  */
  await sendPasswordResetEmailService({
    to: user.email,
    locale: input.locale,
    resetUrl: `${linkOrigin()}${RESET_PASSWORD_ROUTE}?token=${rawToken}`,
    ttlMinutes: RESET_TOKEN_TTL_MINUTES,
  });

  return accepted;
}

/**
 * Whether a raw token would be accepted right now. Used by the reset page so someone arriving on a
 * dead link is told so immediately, rather than after typing a new password twice.
 *
 * Every rejection is the same `INVALID_TOKEN`: unknown, spent and expired are not distinguished,
 * because the difference is only ever useful to someone guessing.
 */
export async function verifyResetTokenService(
  rawToken: string
): Promise<ServiceResult<{ valid: true }>> {
  const token = await passwordResetTokenRepository.findByTokenHash(hashPassword(rawToken));
  if (!token) return { data: { error: 'INVALID_TOKEN' }, status: 400 };
  // Truthy check, not `!== null`: the field is nullable *and* optional in the inferred type.
  if (token.usedAt) return { data: { error: 'INVALID_TOKEN' }, status: 400 };
  if (token.expiresAt.getTime() <= clock.now().getTime()) {
    return { data: { error: 'INVALID_TOKEN' }, status: 400 };
  }

  return { data: { valid: true }, status: 200 };
}

/**
 * Spends a reset link and sets the new password.
 *
 * The token is marked used before anything else is touched, and every other outstanding token for
 * the account goes with it: a reset is the moment to assume the old inbox contents are not trusted.
 */
export async function resetPasswordService(
  input: ResetPasswordType
): Promise<ServiceResult<{ message: string }>> {
  const tokenHash = hashPassword(input.token);
  const token = await passwordResetTokenRepository.findByTokenHash(tokenHash);
  if (!token) return { data: { error: 'INVALID_TOKEN' }, status: 400 };
  if (token.usedAt) return { data: { error: 'INVALID_TOKEN' }, status: 400 };

  const now = clock.now();
  if (token.expiresAt.getTime() <= now.getTime()) {
    return { data: { error: 'INVALID_TOKEN' }, status: 400 };
  }

  const userId = token.userId.toString();
  const user = await userRepository.findById(userId);
  /*
    The account can have been deactivated in the hour since the link was sent. Same generic answer:
    the holder of the link has no business learning that the account exists but is switched off.
  */
  if (!user || !user.isActive) return { data: { error: 'INVALID_TOKEN' }, status: 400 };

  await passwordResetTokenRepository.markAllUsedForUser(userId, now);

  const updated = await userRepository.updateById(userId, {
    passwordHash: hashPassword(input.password),
  });
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: { message: 'PASSWORD_RESET' }, status: 200 };
}
