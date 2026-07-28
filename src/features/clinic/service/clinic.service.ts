import { randomBytes } from 'crypto';

import { Types } from 'mongoose';

import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import {
  ClinicProfile,
  CreateStaffResult,
  RegisterClinicResult,
} from '@/features/clinic/types/clinic.types';
import {
  ClinicProfileType,
  CreateStaffType,
  RegisterClinicType,
  UpdateClinicType,
} from '@/features/clinic/validations/clinic.validation';
import { TRIAL_DAYS } from '@/shared/const/plan.const';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';
import { hashPassword } from '@/shared/utils/password';

const SLUG_SUFFIX_BYTES = 4;
const TEMP_PASSWORD_BYTES = 16;

/** Lowercased, non-alphanumerics collapsed to `-`, plus a random suffix so slugs never collide. */
function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'clinic'}-${randomBytes(SLUG_SUFFIX_BYTES).toString('hex')}`;
}

function toClinicProfile(clinic: ClinicDocument): ClinicProfile {
  return {
    id: clinic._id.toString(),
    name: clinic.name,
    slug: clinic.slug,
    // Schema defaults these to '' but the inferred type stays nullable — normalise for the wire.
    country: clinic.country ?? '',
    city: clinic.city ?? '',
    addressLine: clinic.addressLine ?? '',
    phone: clinic.phone ?? '',
    logoUrl: clinic.logoUrl ?? '',
    locale: clinic.locale,
    timezone: clinic.timezone,
    isActive: clinic.isActive,
  };
}


/**
 * Every clinic begins on the free trial. Set at creation rather than lazily on first read, so the
 * end date is anchored to sign-up and cannot drift by being recomputed later.
 */
function startTrial() {
  return {
    plan: 'trial' as const,
    subscriptionStatus: 'trialing' as const,
    trialEndsAt: clock.addDays(clock.now(), TRIAL_DAYS),
    planRenewsAt: null,
  };
}

/**
 * PRD 02 §A. Three writes with no transaction available (Mongo standalone): create the owner,
 * create the clinic, link the clinic back onto the owner. If either later step fails the owner
 * row is deleted again so a retry with the same email is not blocked by a half-built account.
 */
export async function registerClinicService(
  input: RegisterClinicType
): Promise<ServiceResult<RegisterClinicResult>> {
  const existing = await userRepository.findByEmail(input.owner.email);
  if (existing) return { data: { error: 'EMAIL_TAKEN' }, status: 409 };

  const userId = await userRepository.create({
    name: input.owner.name,
    email: input.owner.email,
    passwordHash: hashPassword(input.owner.password),
    role: 'clinic_owner',
    clinicId: null,
    jobTitle: '',
  });

  try {
    const clinicId = await clinicRepository.create({
      ...input.clinic,
      slug: toSlug(input.clinic.name),
      logoUrl: '',
      ownerId: new Types.ObjectId(userId),
      isActive: true,
      ...startTrial(),
    });

    const linked = await userRepository.updateById(userId, {
      clinicId: new Types.ObjectId(clinicId),
    });
    if (!linked) {
      await clinicRepository.deleteById(clinicId);
      throw new Error('OWNER_LINK_FAILED');
    }

    return { data: { userId, clinicId }, status: 201 };
  } catch {
    await userRepository.deleteById(userId);
    return { data: { error: 'CLINIC_CREATE_FAILED' }, status: 500 };
  }
}

/**
 * Attaches a clinic to an account that already exists.
 *
 * The public sign-up form creates a plain `user`, so anyone who registered that way ends up with
 * no clinic, no dashboard and a 401 on every clinical route. This is the repair path: it promotes
 * that account to `clinic_owner` and links a freshly created clinic to it.
 */
export async function createClinicForUserService(
  userId: string,
  input: ClinicProfileType
): Promise<ServiceResult<ClinicProfile>> {
  const user = await userRepository.findById(userId);
  if (!user) return { data: { error: 'NOT_FOUND' }, status: 404 };
  // Never let an existing membership be silently replaced — that would strand the old clinic.
  if (user.clinicId) return { data: { error: 'ALREADY_IN_CLINIC' }, status: 409 };

  const clinicId = await clinicRepository.create({
    ...input,
    slug: toSlug(input.name),
    logoUrl: '',
    ownerId: new Types.ObjectId(userId),
    isActive: true,
    ...startTrial(),
  });

  const linked = await userRepository.updateById(userId, {
    clinicId: new Types.ObjectId(clinicId),
    role: 'clinic_owner',
  });

  if (!linked) {
    await clinicRepository.deleteById(clinicId);
    return { data: { error: 'CLINIC_CREATE_FAILED' }, status: 500 };
  }

  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_CREATE_FAILED' }, status: 500 };

  return { data: toClinicProfile(clinic), status: 201 };
}

export async function getClinicService(clinicId: string): Promise<ServiceResult<ClinicProfile>> {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return { data: toClinicProfile(clinic), status: 200 };
}

export async function updateClinicService(
  clinicId: string,
  input: UpdateClinicType
): Promise<ServiceResult<ClinicProfile>> {
  const updated = await clinicRepository.updateById(clinicId, input);
  if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return getClinicService(clinicId);
}

/**
 * Owner-only staff creation. The generated password is handed back in plaintext once so the
 * owner can pass it on in person — there is no email or SMS channel in this product.
 */
export async function createStaffService(
  clinicId: string,
  input: CreateStaffType
): Promise<ServiceResult<CreateStaffResult>> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) return { data: { error: 'EMAIL_TAKEN' }, status: 409 };

  const temporaryPassword = randomBytes(TEMP_PASSWORD_BYTES).toString('base64url');
  const userId = await userRepository.create({
    name: input.name,
    email: input.email,
    passwordHash: hashPassword(temporaryPassword),
    role: 'clinic_staff',
    clinicId: new Types.ObjectId(clinicId),
    jobTitle: input.jobTitle,
  });

  return { data: { userId, email: input.email, temporaryPassword }, status: 201 };
}
