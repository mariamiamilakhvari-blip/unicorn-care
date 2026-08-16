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
  CreateClinicForUserType,
  CreateStaffType,
  RegisterClinicType,
  UpdateClinicType,
} from '@/features/clinic/validations/clinic.validation';
import { CONSENT_VERSION, DPA_VERSION } from '@/shared/const/consent.const';
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
    email: clinic.email ?? '',
    taxId: clinic.taxId ?? '',
    logoUrl: clinic.logoUrl ?? '',
    locale: clinic.locale,
    timezone: clinic.timezone,
    isActive: clinic.isActive,
  };
}


/**
 * The consent record written beside a new clinic.
 *
 * The booleans themselves are not stored. Every one of them is mandatory, so a row of `true`
 * carries no information — what has to be provable later is *when* the clinic accepted and
 * *which wording* it accepted, and the schema rejected the request outright if any box was
 * unticked. The clock is read here rather than trusted from the body.
 */
function recordConsent() {
  return { consent: { version: CONSENT_VERSION, acceptedAt: clock.now() } };
}

/**
 * The Data Processing Agreement record written beside a new clinic.
 *
 * Takes no boolean, unlike the Business Associate Agreement it replaced. That one was required of
 * US clinics and merely offered to everyone else, so "did they accept" was a real question with a
 * real answer worth storing. The Law of Georgia on Personal Data Protection requires a written
 * processor agreement from every controller that engages one, so acceptance is mandatory, the
 * schema rejects a registration without it, and a stored flag could only ever read `true` — a
 * field with one possible value is not evidence, it is noise that invites a reader to believe the
 * other value is reachable.
 *
 * What remains is what a countersigned copy would show: which version, when, and from where.
 *
 * Version, clock and IP are all taken here rather than from the request body. A client-supplied
 * timestamp is not evidence, and a client-supplied version would let a caller claim it accepted
 * wording that was never shown to it. The IP comes from the request headers via the route; it is
 * supporting provenance for an executed contract, not an identity, and nothing authorises off it.
 */
function recordDataProcessingAgreement(ip: string) {
  return {
    dpa: {
      version: DPA_VERSION,
      acceptedAt: clock.now(),
      ip,
    },
  };
}

/**
 * A clinic starts with no ratings, written explicitly rather than left to the schema default so
 * the aggregate fields exist on the document from the first read. `avgDoctorScore: 0` is not a
 * score of zero — `MIN_RATINGS_FOR_AVERAGE` keeps any average hidden until there are enough
 * ratings for one to mean anything.
 */
function blankRatings() {
  return { ratingCount: 0, avgDoctorScore: 0, avgClinicScore: 0 };
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
  input: RegisterClinicType,
  ip: string
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
      ...blankRatings(),
      ...recordConsent(),
      ...recordDataProcessingAgreement(ip),
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
  input: CreateClinicForUserType,
  ip: string
): Promise<ServiceResult<ClinicProfile>> {
  const user = await userRepository.findById(userId);
  if (!user) return { data: { error: 'NOT_FOUND' }, status: 404 };
  // Never let an existing membership be silently replaced — that would strand the old clinic.
  if (user.clinicId) return { data: { error: 'ALREADY_IN_CLINIC' }, status: 409 };

  /*
    Defence in depth. The route schema already rejects a missing or false consent, but this
    service is callable from anywhere in the codebase, and the consent record written below is
    only honest if every box really was ticked. Cheap to check, and it fails loudly if some
    future caller skips validation.
  */
  const { consents, ...profile } = input;
  /*
    One loop over all of them now. The Data Processing Agreement used to be checked separately
    because it was a US-only Business Associate Agreement, mandatory for some clinics and merely
    offered to the rest. Under the Law of Georgia on Personal Data Protection every controller
    engaging a processor needs a written agreement, so it is mandatory for everyone and there is
    nothing left to special-case.
  */
  if (Object.values(consents).some(given => given !== true)) {
    return { data: { error: 'CONSENT_REQUIRED' }, status: 400 };
  }
  const clinicId = await clinicRepository.create({
    ...profile,
    slug: toSlug(input.name),
    logoUrl: '',
    ownerId: new Types.ObjectId(userId),
    isActive: true,
    ...startTrial(),
    ...blankRatings(),
    ...recordConsent(),
    ...recordDataProcessingAgreement(ip),
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
