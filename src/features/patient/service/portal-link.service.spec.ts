import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/patient/repository/patient-portal-link.repository', () => ({
  patientPortalLinkRepository: {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    markUsed: vi.fn(),
    markAllUsedForPatient: vi.fn(),
  },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findByEmail: vi.fn(), findById: vi.fn() },
}));

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

vi.mock('@/features/notifications/service/portal-link-email.service', () => ({
  sendPortalLinkEmailService: vi.fn(),
}));

vi.mock('@/features/patient/service/patient-access.service', () => ({
  mintAccessToken: vi.fn(),
  tokenTag: () => 'tag',
}));

import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { sendPortalLinkEmailService } from '@/features/notifications/service/portal-link-email.service';
import { patientPortalLinkRepository } from '@/features/patient/repository/patient-portal-link.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientPortalLinkDocument } from '@/features/patient/schema/patient-portal-link.schema';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { mintAccessToken } from '@/features/patient/service/patient-access.service';
import {
  PORTAL_LINK_TTL_MINUTES,
  redeemPortalLinkService,
  requestPortalLinkService,
} from '@/features/patient/service/portal-link.service';
import { clock } from '@/shared/lib/clock';

const links = vi.mocked(patientPortalLinkRepository);
const patients = vi.mocked(patientRepository);
const clinics = vi.mocked(clinicRepository);
const sendEmail = vi.mocked(sendPortalLinkEmailService);
const mint = vi.mocked(mintAccessToken);

const PATIENT = '507f1f77bcf86cd799439011';
const CLINIC = '507f1f77bcf86cd799439022';

const NOW = new Date('2026-08-12T09:00:00.000Z');

const patient = (overrides: Partial<PatientDocument> = {}) =>
  ({
    _id: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    email: 'patient@example.com',
    locale: 'ka',
    ...overrides,
  }) as PatientDocument;

const link = (overrides: Partial<PatientPortalLinkDocument> = {}) =>
  ({
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439033'),
    patientId: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    usedAt: null,
    ...overrides,
  }) as PatientPortalLinkDocument;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(clock, 'now').mockReturnValue(NOW);
  clinics.findById.mockResolvedValue({ name: 'Clinic', timezone: 'Asia/Tbilisi' } as never);
  mint.mockResolvedValue('fresh-access-token');
  links.markUsed.mockResolvedValue(true);
});

describe('requestPortalLinkService', () => {
  /**
   * The whole endpoint is unauthenticated, so its answer is the only thing a stranger learns from
   * it. A patient list is a list of people who had surgery at a named clinic — if a real address
   * answered differently from an invented one, that list could be walked from a browser.
   */
  it.each([
    ['an unknown address', null],
    // The archived-patient case retired with archiving itself: a patient now either exists or has
    // been erased, and an erased one is indistinguishable from an unknown address above.
    ['a patient with no email on file', patient({ email: null as never })],
  ])('answers the same for %s as for a real one', async (_label, found) => {
    patients.findByEmail.mockResolvedValue(found as never);

    const { data, status } = await requestPortalLinkService({ email: 'someone@example.com' });

    expect(status).toBe(200);
    expect(data).toEqual({ message: 'PORTAL_LINK_REQUESTED' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(links.create).not.toHaveBeenCalled();
  });

  it('sends a link to a patient in their own language', async () => {
    patients.findByEmail.mockResolvedValue(patient({ locale: 'en' }) as never);

    await requestPortalLinkService({ email: 'patient@example.com' });

    expect(sendEmail).toHaveBeenCalledOnce();
    const sent = sendEmail.mock.calls[0][0];
    expect(sent.to).toBe('patient@example.com');
    expect(sent.locale).toBe('en');
    expect(sent.portalUrl).toContain('/p/login/');
    expect(sent.ttlHours).toBe(24);
  });

  it('stores only the hash, never the token that was emailed', async () => {
    patients.findByEmail.mockResolvedValue(patient() as never);

    await requestPortalLinkService({ email: 'patient@example.com' });

    const stored = links.create.mock.calls[0][0];
    const emailed = sendEmail.mock.calls[0][0].portalUrl.split('/').pop();
    expect(emailed).toBeTruthy();
    expect(stored.tokenHash).not.toContain(emailed);
    expect(stored.expiresAt).toEqual(
      new Date(NOW.getTime() + PORTAL_LINK_TTL_MINUTES * 60 * 1000)
    );
  });

  /**
   * Issuing is additive. Every notification email carries its own link now, so spending the
   * patient's outstanding set here would mean asking for a link killed every reminder already in
   * the inbox — and, when the request was made twice because the first message was slow, killed
   * the one that finally arrived.
   */
  it('leaves the patient’s other outstanding links alone', async () => {
    patients.findByEmail.mockResolvedValue(patient() as never);

    await requestPortalLinkService({ email: 'patient@example.com' });

    expect(links.create).toHaveBeenCalledOnce();
    expect(links.markAllUsedForPatient).not.toHaveBeenCalled();
  });
});

describe('redeemPortalLinkService', () => {
  it('mints an access token and spends the link', async () => {
    links.findByTokenHash.mockResolvedValue(link() as never);
    patients.findById.mockResolvedValue(patient() as never);

    const { data, status } = await redeemPortalLinkService('raw');

    expect(status).toBe(200);
    expect(data).toEqual({ accessToken: 'fresh-access-token' });
    expect(links.markUsed).toHaveBeenCalledWith('507f1f77bcf86cd799439033', NOW);
  });

  /**
   * Only the link that was followed. Opening today's reminder must not kill the rest of the
   * inbox — those older emails are what a patient reaches for from a device with no session.
   */
  it('spends the followed link and no other', async () => {
    links.findByTokenHash.mockResolvedValue(link() as never);
    patients.findById.mockResolvedValue(patient() as never);

    await redeemPortalLinkService('raw');

    expect(links.markAllUsedForPatient).not.toHaveBeenCalled();
  });

  /**
   * The write is the claim. Two requests carrying the same token — a mail client prefetching the
   * URL and the patient then pressing the button — must not both come away with a session.
   */
  it('refuses the loser of a race for the same link', async () => {
    links.findByTokenHash.mockResolvedValue(link() as never);
    patients.findById.mockResolvedValue(patient() as never);
    links.markUsed.mockResolvedValue(false);

    const { status } = await redeemPortalLinkService('raw');

    expect(status).toBe(401);
    expect(mint).not.toHaveBeenCalled();
  });

  /** Every rejection is the same 401: the difference is only ever useful to someone guessing. */
  it.each([
    ['an unknown link', null, null],
    ['a link already used', link({ usedAt: NOW }), null],
    ['an expired link', link({ expiresAt: new Date(NOW.getTime() - 1) }), null],
    // A link whose patient no longer exists is the `null` patient case, which the row above covers.
    ['a link whose patient is gone', link(), null],
  ])('refuses %s', async (_label, found, foundPatient) => {
    links.findByTokenHash.mockResolvedValue(found as never);
    patients.findById.mockResolvedValue(foundPatient as never);

    const { data, status } = await redeemPortalLinkService('raw');

    expect(status).toBe(401);
    expect(data).toEqual({ error: 'INVALID_TOKEN' });
    expect(mint).not.toHaveBeenCalled();
  });

  /** A link is single use: the second visit to the same URL must not open a second session. */
  it('does not mint twice for the same link', async () => {
    links.findByTokenHash.mockResolvedValueOnce(link() as never);
    patients.findById.mockResolvedValue(patient() as never);
    await redeemPortalLinkService('raw');

    links.findByTokenHash.mockResolvedValueOnce(link({ usedAt: NOW }) as never);
    const { status } = await redeemPortalLinkService('raw');

    expect(status).toBe(401);
    expect(mint).toHaveBeenCalledOnce();
  });
});
