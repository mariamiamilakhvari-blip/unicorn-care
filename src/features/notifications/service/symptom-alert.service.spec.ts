import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));
vi.mock('@/features/auth/repository/user.repository', () => ({
  userRepository: { findById: vi.fn() },
}));
vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));
vi.mock('@/shared/lib/resend-client', () => ({
  resendClient: { isConfigured: vi.fn(), send: vi.fn() },
}));

import { userRepository } from '@/features/auth/repository/user.repository';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { ClinicDocument } from '@/features/clinic/schema/clinic.schema';
import {
  SymptomAlertDetails,
  sendSymptomAlertService,
} from '@/features/notifications/service/symptom-alert.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { resendClient } from '@/shared/lib/resend-client';

const clinics = vi.mocked(clinicRepository);
const users = vi.mocked(userRepository);
const patients = vi.mocked(patientRepository);
const resend = vi.mocked(resendClient);

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CLINIC_ID = '507f1f77bcf86cd799439022';
const OWNER_ID = '507f1f77bcf86cd799439033';

const clinic = (overrides: Partial<ClinicDocument> = {}) =>
  ({
    _id: new mongoose.Types.ObjectId(CLINIC_ID),
    name: 'Gagua Clinic',
    email: 'info@gagua.ge',
    addressLine: 'Vazha-Pshavela 27b',
    phone: '+995 32 2 122 122',
    locale: 'en',
    timezone: 'Asia/Tbilisi',
    ownerId: new mongoose.Types.ObjectId(OWNER_ID),
    ...overrides,
  }) as ClinicDocument;

const patient = () =>
  ({
    _id: new mongoose.Types.ObjectId(PATIENT_ID),
    firstName: 'Nino',
    lastName: 'Beridze',
  }) as PatientDocument;

const sentEmail = () => resend.send.mock.calls[0][0];

const run = (over: Partial<SymptomAlertDetails> = {}) =>
  sendSymptomAlertService(PATIENT_ID, CLINIC_ID, {
    warningTitle: 'Temperature over 38',
    severityLabel: 'Call your clinic',
    contactMethod: 'phone',
    contactPhone: '+995 555 12 34 56',
    ...over,
  });

describe('sendSymptomAlertService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resend.isConfigured.mockReturnValue(true);
    resend.send.mockResolvedValue({ ok: true, id: 'email-1' });
    clinics.findById.mockResolvedValue(clinic());
    users.findById.mockResolvedValue({ email: 'owner@gagua.ge' } as never);
    patients.findById.mockResolvedValue(patient());
  });

  it("emails the clinic's contact address", async () => {
    expect(await run()).toBe(true);
    expect(sentEmail().to).toBe('info@gagua.ge');
  });

  it('falls back to the owner when the clinic has no contact address', async () => {
    clinics.findById.mockResolvedValue(clinic({ email: '' }));

    await run();

    expect(sentEmail().to).toBe('owner@gagua.ge');
  });

  it('names the patient, so the clinic knows who to look up', async () => {
    await run();

    expect(sentEmail().subject).toContain('Nino Beridze');
    expect(sentEmail().html).toContain('Nino Beridze');
  });

  it('carries the guide label the patient tapped', async () => {
    await run({ warningTitle: 'Temperature over 38' });

    expect(sentEmail().html).toContain('Temperature over 38');
  });

  /**
   * The rule that matters most, and the one most likely to be "improved" away later: the free
   * text a patient wrote about their own body is the most sensitive part of the report, and it
   * does not travel through a mail provider to a shared clinic inbox. It stays behind the login.
   */
  it('never carries the free text the patient wrote', async () => {
    await run();

    /*
      The service is not even given the note. `SymptomAlertDetails` is the whole of what it
      receives beyond the two ids, so this pins that no field carrying the patient's own words is
      ever added to it — a compile error here is the point, not a test failure.
    */
    const details: Record<keyof SymptomAlertDetails, true> = {
      warningTitle: true,
      severityLabel: true,
      contactMethod: true,
      contactPhone: true,
    };
    expect(Object.keys(details).sort()).toEqual([
      'contactMethod',
      'contactPhone',
      'severityLabel',
      'warningTitle',
    ]);
    expect(sentEmail().html).toContain('not included in this email');
  });

  it('says plainly that this is not monitoring', async () => {
    // A clinic treating this as a safety net would be relying on something the Terms disclaim.
    await run();

    expect(sentEmail().html).toContain('not monitoring');
    expect(sentEmail().html).toContain('emergency services');
  });

  it('links to the review queue', async () => {
    await run();

    expect(sentEmail().html).toContain('/dashboard');
  });

  it("writes in the clinic's language", async () => {
    clinics.findById.mockResolvedValue(clinic({ locale: 'ka' }));

    await run();

    expect(sentEmail().subject).toContain('პაციენტმა');
  });

  it('escapes a patient name rather than trusting it in HTML', async () => {
    patients.findById.mockResolvedValue({
      ...patient(),
      firstName: '<script>alert(1)</script>',
      lastName: '',
    } as PatientDocument);

    await run();

    expect(sentEmail().html).not.toContain('<script>');
  });

  describe('never blocking the report', () => {
    it.each([
      ['email is not configured', () => resend.isConfigured.mockReturnValue(false)],
      ['the clinic is missing', () => clinics.findById.mockResolvedValue(null)],
      ['the patient is missing', () => patients.findById.mockResolvedValue(null)],
      [
        'there is no address to send to',
        () => {
          clinics.findById.mockResolvedValue(clinic({ email: '' }));
          users.findById.mockResolvedValue(null as never);
        },
      ],
    ])('returns false without throwing when %s', async (_label, arrange) => {
      arrange();

      await expect(run()).resolves.toBe(false);
    });

    it('returns false when the provider rejects the send', async () => {
      resend.send.mockResolvedValue({ ok: false, statusCode: 403, message: 'domain unverified' });

      await expect(run()).resolves.toBe(false);
    });

    it('returns false when a lookup throws', async () => {
      // Filing the report must succeed even if everything about the alert fails.
      clinics.findById.mockRejectedValue(new Error('database gone'));

      await expect(run()).resolves.toBe(false);
    });
  });
});
