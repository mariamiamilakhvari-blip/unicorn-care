import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));

/*
  Minting a link is a database write and sending is a network call. Both are mocked so this spec is
  about which patients are written to and what the message carries, not about either mechanism.
  `NOTIFICATION_LINK_TTL_MINUTES` is re-declared with its real value: the assertion below is that
  the email states the same window the link was actually minted with.
*/
vi.mock('@/features/patient/service/portal-link.service', () => ({
  issuePortalLink: vi.fn(),
  NOTIFICATION_LINK_TTL_MINUTES: 30 * 24 * 60,
}));

vi.mock('@/features/notifications/service/portal-link-email.service', () => ({
  sendPortalLinkEmailService: vi.fn(),
}));

import { CarePlanDocument } from '@/features/care-plan/schema/care-plan.schema';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import { sendPlanUpdatedLinkService } from '@/features/notifications/service/plan-update-email.service';
import { sendPortalLinkEmailService } from '@/features/notifications/service/portal-link-email.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { issuePortalLink } from '@/features/patient/service/portal-link.service';

const patients = vi.mocked(patientRepository);
const mintLink = vi.mocked(issuePortalLink);
const sendEmail = vi.mocked(sendPortalLinkEmailService);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const PATIENT_ID = '507f1f77bcf86cd799439022';
const PLAN_ID = '507f1f77bcf86cd799439044';

const PORTAL_URL = 'https://example.test/p/login/tok';

const plan = () =>
  ({
    _id: new Types.ObjectId(PLAN_ID),
    patientId: new Types.ObjectId(PATIENT_ID),
    clinicId: new Types.ObjectId(CLINIC_ID),
  }) as CarePlanDocument;

const clinic = (over: Partial<ClinicDocument> = {}) =>
  ({
    name: 'Unicorn Clinic',
    addressLine: '1 Rustaveli Ave',
    phone: '+995 32 000 0000',
    email: 'hello@clinic.test',
    timezone: 'Asia/Tbilisi',
    locale: 'ka',
    ...over,
  }) as ClinicDocument;

const patient = (over: Record<string, unknown> = {}) =>
  ({
    _id: new Types.ObjectId(PATIENT_ID),
    clinicId: new Types.ObjectId(CLINIC_ID),
    email: 'patient@example.test',
    locale: 'en',
    notificationsRevokedAt: null,
    portalAccessRevokedAt: null,
    emailSuppressedAt: null,
    ...over,
  }) as never;

describe('sendPlanUpdatedLinkService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    patients.findById.mockResolvedValue(patient());
    mintLink.mockResolvedValue(PORTAL_URL);
    sendEmail.mockResolvedValue(true);
  });

  it('mints a link and emails it to the patient', async () => {
    const sent = await sendPlanUpdatedLinkService(plan(), clinic());

    expect(sent).toBe(true);
    expect(mintLink).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'patient@example.test',
      portalUrl: PORTAL_URL,
    });
  });

  /** The window the email prints has to be the window the link was actually minted with. */
  it('states the same lifetime the link was issued for', async () => {
    await sendPlanUpdatedLinkService(plan(), clinic());

    const [, , ttlMinutes] = mintLink.mock.calls[0];
    expect(sendEmail.mock.calls[0][0].ttlHours).toBe(ttlMinutes / 60);
  });

  /**
   * The notification lifetime, not the requested-link one. This email is not asked for — it goes
   * out when a clinic saves an edit, and a patient who reads their mail days later must not find a
   * second dead link where the fix was meant to be.
   */
  it('issues a link that lasts the month, not the day', async () => {
    await sendPlanUpdatedLinkService(plan(), clinic());

    expect(mintLink.mock.calls[0][2]).toBe(30 * 24 * 60);
  });

  /** The patient's own language wins; the clinic's is the fallback for a record predating it. */
  it('writes in the patient language', async () => {
    await sendPlanUpdatedLinkService(plan(), clinic({ locale: 'ka' }));

    expect(sendEmail.mock.calls[0][0].locale).toBe('en');
  });

  it('falls back to the clinic language when the record has none', async () => {
    patients.findById.mockResolvedValue(patient({ locale: null }));

    await sendPlanUpdatedLinkService(plan(), clinic({ locale: 'ka' }));

    expect(sendEmail.mock.calls[0][0].locale).toBe('ka');
  });

  /** The footer carries the clinic a patient would actually call, as every patient email does. */
  it('signs the message with the clinic', async () => {
    await sendPlanUpdatedLinkService(plan(), clinic());

    expect(sendEmail.mock.calls[0][0].clinic).toMatchObject({
      name: 'Unicorn Clinic',
      phone: '+995 32 000 0000',
    });
  });

  /*
    Every gate below is a patient who must not be written to, and each is checked before the link
    is minted — a row written for a message that is never sent is a live credential nobody asked
    for.
  */
  describe('who is not written to', () => {
    it.each([
      ['there is no patient record', null],
      ['the record has no address', patient({ email: '' })],
      ['notifications were withdrawn', patient({ notificationsRevokedAt: new Date() })],
      ['the clinic closed the portal', patient({ portalAccessRevokedAt: new Date() })],
      ['the address is suppressed', patient({ emailSuppressedAt: new Date() })],
    ])('stays silent when %s', async (_case, record) => {
      patients.findById.mockResolvedValue(record as never);

      expect(await sendPlanUpdatedLinkService(plan(), clinic())).toBe(false);
      expect(mintLink).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  /*
    Never throws, in either direction. The caller is a clinic saving an edit, and a mail provider
    outage must not roll back a correction to a live medical plan.
  */
  describe('a failure never reaches the caller', () => {
    it('reports false when the link cannot be minted', async () => {
      mintLink.mockRejectedValue(new Error('mongo is down'));

      expect(await sendPlanUpdatedLinkService(plan(), clinic())).toBe(false);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('reports false when the send throws', async () => {
      sendEmail.mockRejectedValue(new Error('resend is down'));

      expect(await sendPlanUpdatedLinkService(plan(), clinic())).toBe(false);
    });

    it('reports false when the patient read throws', async () => {
      patients.findById.mockRejectedValue(new Error('mongo is down'));

      expect(await sendPlanUpdatedLinkService(plan(), clinic())).toBe(false);
    });
  });
});
