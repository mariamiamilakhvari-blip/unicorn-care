import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/data-protection/repository/consent-record.repository', () => ({
  consentRecordRepository: {
    create: vi.fn(),
    createMany: vi.fn(),
    findActiveByPatient: vi.fn(),
    revoke: vi.fn(),
  },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

import { consentRecordRepository } from '@/features/data-protection/repository/consent-record.repository';
import {
  changePatientConsentService,
  getConsentSettingsService,
  recordIntakeConsentsService,
  revokeConsentForPatientService,
} from '@/features/data-protection/service/consent.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { CONSENT_VERSION } from '@/shared/const/consent.const';

const consentRepo = vi.mocked(consentRecordRepository);
const patientRepo = vi.mocked(patientRepository);

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CLINIC_ID = '507f1f77bcf86cd799439022';
const IP = '203.0.113.7';
const NOW = new Date('2026-08-16T09:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  patientRepo.findById.mockResolvedValue({ _id: PATIENT_ID } as never);
  patientRepo.updateById.mockResolvedValue(true);
  consentRepo.createMany.mockResolvedValue(0);
  consentRepo.revoke.mockResolvedValue(1);
});

/**
 * The audit trail is the product's legal footing under the Law of Georgia on Personal Data
 * Protection, so what is pinned here is what makes a record admissible: one row per purpose, the
 * wording version and the timestamp taken server-side, and an attestation nobody gave never
 * appearing as one.
 */
describe('recordIntakeConsentsService', () => {
  it('writes one row per granted purpose, versioned and stamped from the server clock', async () => {
    await recordIntakeConsentsService(PATIENT_ID, CLINIC_ID, ['healthData', 'notifications'], IP);

    const rows = consentRepo.createMany.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      consentType: 'healthData',
      source: 'clinic_intake',
      grantedAt: NOW,
      revokedAt: null,
      consentTextVersion: CONSENT_VERSION,
      ipAddress: IP,
    });
    expect(rows[1]).toMatchObject({ consentType: 'notifications' });
  });

  it('writes nothing when no consent was granted, rather than a row recording a refusal', async () => {
    await recordIntakeConsentsService(PATIENT_ID, CLINIC_ID, [], IP);

    expect(consentRepo.createMany).not.toHaveBeenCalled();
  });

  it('never fails the caller — a clinic must be able to enter a patient', async () => {
    // A gap in an audit trail is repairable. A clinic that cannot admit a patient because the
    // audit collection is unavailable is not.
    consentRepo.createMany.mockRejectedValue(new Error('collection unavailable'));

    await expect(
      recordIntakeConsentsService(PATIENT_ID, CLINIC_ID, ['personalData'], IP)
    ).resolves.toBe(0);
  });
});

describe('changePatientConsentService', () => {
  it('refuses a consent the patient may not change here, with a 403 rather than silence', async () => {
    // Withdrawing the basis for holding a clinical record is an erasure request weighed against
    // statutory retention, not a switch. Accepting the toggle and doing nothing would be worse.
    const result = await changePatientConsentService(
      PATIENT_ID,
      CLINIC_ID,
      'healthData',
      false,
      IP
    );

    expect(result.status).toBe(403);
    expect(consentRepo.revoke).not.toHaveBeenCalled();
    expect(patientRepo.updateById).not.toHaveBeenCalled();
  });

  it('withdraws the audit row and the runtime flag together', async () => {
    const result = await changePatientConsentService(
      PATIENT_ID,
      CLINIC_ID,
      'notifications',
      false,
      IP
    );

    expect(consentRepo.revoke).toHaveBeenCalledWith(
      PATIENT_ID,
      'notifications',
      NOW,
      'patient_portal',
      ''
    );
    // The flag is what the dispatch sweep reads; the row is what proves why it stopped.
    expect(patientRepo.updateById).toHaveBeenCalledWith(PATIENT_ID, CLINIC_ID, {
      notificationsRevokedAt: NOW,
    });
    expect(result.data).toEqual({ type: 'notifications', granted: false });
  });

  it('re-granting writes a fresh row rather than clearing the old withdrawal', async () => {
    await changePatientConsentService(PATIENT_ID, CLINIC_ID, 'notifications', true, IP);

    // The gap is a fact. A clinic asked whether this patient consented in March has to be able to
    // see that for a while they did not.
    expect(consentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        consentType: 'notifications',
        source: 'patient_portal',
        grantedAt: NOW,
        revokedAt: null,
        consentTextVersion: CONSENT_VERSION,
      })
    );
    expect(patientRepo.updateById).toHaveBeenCalledWith(PATIENT_ID, CLINIC_ID, {
      notificationsRevokedAt: null,
    });
  });

  it('closes the portal on its own flag, separately from messages', async () => {
    await changePatientConsentService(PATIENT_ID, CLINIC_ID, 'portalAccess', false, IP);

    expect(patientRepo.updateById).toHaveBeenCalledWith(PATIENT_ID, CLINIC_ID, {
      portalAccessRevokedAt: NOW,
    });
  });

  it('refuses a patient that does not resolve under this clinic', async () => {
    patientRepo.findById.mockResolvedValue(null);

    const result = await changePatientConsentService(
      PATIENT_ID,
      CLINIC_ID,
      'notifications',
      false,
      IP
    );

    expect(result.status).toBe(404);
  });
});

describe('revokeConsentForPatientService', () => {
  it('records a withdrawal relayed by staff as weaker evidence, with the note kept', async () => {
    // The Law on Patient Rights does not require a withdrawal to arrive through any particular
    // channel, so one made by telephone has to be honoured — and visibly distinguished from the
    // patient acting for themselves.
    await revokeConsentForPatientService(
      PATIENT_ID,
      CLINIC_ID,
      'notifications',
      'Requested by telephone'
    );

    expect(consentRepo.revoke).toHaveBeenCalledWith(
      PATIENT_ID,
      'notifications',
      NOW,
      'staff_request',
      'Requested by telephone'
    );
  });
});

describe('getConsentSettingsService', () => {
  it('marks which consents the patient may change for themselves', async () => {
    consentRepo.findActiveByPatient.mockResolvedValue([
      {
        consentType: 'notifications',
        source: 'clinic_intake',
        grantedAt: NOW,
        revokedAt: null,
        consentTextVersion: CONSENT_VERSION,
      },
      {
        consentType: 'healthData',
        source: 'clinic_intake',
        grantedAt: NOW,
        revokedAt: null,
        consentTextVersion: CONSENT_VERSION,
      },
    ] as never);

    const result = await getConsentSettingsService(PATIENT_ID);
    const consents = 'consents' in result.data ? result.data.consents : [];

    expect(consents.find(item => item.type === 'notifications')?.isRevocable).toBe(true);
    expect(consents.find(item => item.type === 'healthData')?.isRevocable).toBe(false);
  });
});
