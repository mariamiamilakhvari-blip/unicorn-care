import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/data-protection/repository/data-request.repository', () => ({
  dataRequestRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByPatient: vi.fn(),
    findOpenByClinic: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn(), updateById: vi.fn() },
}));

import { dataRequestRepository } from '@/features/data-protection/repository/data-request.repository';
import {
  createDataRequestService,
  resolveDataRequestService,
} from '@/features/data-protection/service/data-request.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { ERASED_PLACEHOLDER } from '@/shared/const/retention.const';

const requestRepo = vi.mocked(dataRequestRepository);
const patientRepo = vi.mocked(patientRepository);

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CLINIC_ID = '507f1f77bcf86cd799439022';
const REQUEST_ID = '507f1f77bcf86cd799439033';
const USER_ID = '507f1f77bcf86cd799439044';
const IP = '203.0.113.7';
const NOW = new Date('2026-08-16T09:00:00.000Z');

const openRequest = (kind: 'correction' | 'erasure') =>
  ({
    _id: { toString: () => REQUEST_ID },
    patientId: { toString: () => PATIENT_ID },
    kind,
    status: 'open',
    detail: '',
    resolution: '',
    requestedAt: NOW,
    resolvedAt: null,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  patientRepo.findById.mockResolvedValue({ _id: PATIENT_ID } as never);
  patientRepo.updateById.mockResolvedValue(true);
  requestRepo.findByPatient.mockResolvedValue([]);
  requestRepo.updateById.mockResolvedValue(true);
});

describe('createDataRequestService', () => {
  it('refuses a second open request of the same kind rather than stacking it', async () => {
    // Someone pressing the button twice has not made two requests, and a clinic queue that says
    // they did is a queue that gets ignored.
    requestRepo.findByPatient.mockResolvedValue([{ kind: 'erasure', status: 'open' }] as never);

    const result = await createDataRequestService(
      PATIENT_ID,
      CLINIC_ID,
      { kind: 'erasure', detail: '' },
      IP
    );

    expect(result.status).toBe(409);
    expect(requestRepo.create).not.toHaveBeenCalled();
  });

  it('allows a new request once the previous one of that kind was answered', async () => {
    requestRepo.findByPatient.mockResolvedValue([
      { kind: 'erasure', status: 'refused' },
    ] as never);
    requestRepo.create.mockResolvedValue(REQUEST_ID);
    requestRepo.findById.mockResolvedValue(openRequest('erasure'));

    const result = await createDataRequestService(
      PATIENT_ID,
      CLINIC_ID,
      { kind: 'erasure', detail: '' },
      IP
    );

    expect(result.status).toBe(201);
  });
});

/**
 * The erasure path is where two statutes meet and both bind: the Law of Georgia on Personal Data
 * Protection gives the patient a right to erasure, and the Law of Georgia on Health Care requires
 * the clinical record to be kept regardless. These cases pin the line between them, because it is
 * the one place in the product where getting it wrong breaks a law in either direction.
 */
describe('resolveDataRequestService — erasure', () => {
  beforeEach(() => {
    requestRepo.findById.mockResolvedValue(openRequest('erasure'));
  });

  it('clears contact and identity data, marking the names as erased rather than blanking them', async () => {
    await resolveDataRequestService(REQUEST_ID, CLINIC_ID, USER_ID, {
      status: 'completed',
      resolution: 'Contact details removed; clinical record retained.',
    });

    expect(patientRepo.updateById).toHaveBeenCalledWith(
      PATIENT_ID,
      CLINIC_ID,
      expect.objectContaining({
        firstName: ERASED_PLACEHOLDER,
        lastName: ERASED_PLACEHOLDER,
        phone: '',
        email: '',
        notes: '',
        erasedAt: NOW,
      })
    );
  });

  it('keeps the fields a clinician needs to read the retained record safely', async () => {
    await resolveDataRequestService(REQUEST_ID, CLINIC_ID, USER_ID, {
      status: 'completed',
      resolution: 'Done.',
    });

    // A dose is only interpretable against age and sex, and deleting an allergy list
    // could injure someone. None of the three may appear in the erasure patch.
    const patch = patientRepo.updateById.mock.calls[0][2];
    expect(patch).not.toHaveProperty('allergies');
    expect(patch).not.toHaveProperty('age');
    expect(patch).not.toHaveProperty('sex');
  });

  it('stops further automated messages, which the patient plainly did not consent to', async () => {
    await resolveDataRequestService(REQUEST_ID, CLINIC_ID, USER_ID, {
      status: 'completed',
      resolution: 'Done.',
    });

    expect(patientRepo.updateById).toHaveBeenCalledWith(
      PATIENT_ID,
      CLINIC_ID,
      expect.objectContaining({
        notificationsRevokedAt: NOW,
        portalAccessRevokedAt: NOW,
      })
    );
  });

  it('changes nothing on the patient when the clinic refuses, and records the reason', async () => {
    await resolveDataRequestService(REQUEST_ID, CLINIC_ID, USER_ID, {
      status: 'refused',
      resolution: 'Retained under the Law of Georgia on Health Care.',
    });

    expect(patientRepo.updateById).not.toHaveBeenCalled();
    expect(requestRepo.updateById).toHaveBeenCalledWith(
      REQUEST_ID,
      CLINIC_ID,
      expect.objectContaining({
        status: 'refused',
        resolution: 'Retained under the Law of Georgia on Health Care.',
        resolvedAt: NOW,
      })
    );
  });
});

describe('resolveDataRequestService — corrections and re-answers', () => {
  it('records a correction without touching the patient record itself', async () => {
    // Correcting a clinical record is a clinical act. The clinic edits the patient through the
    // normal path; this only closes the request.
    requestRepo.findById.mockResolvedValue(openRequest('correction'));

    await resolveDataRequestService(REQUEST_ID, CLINIC_ID, USER_ID, {
      status: 'completed',
      resolution: 'Date of birth corrected.',
    });

    expect(patientRepo.updateById).not.toHaveBeenCalled();
  });

  it('refuses to re-answer a request that was already answered', async () => {
    // The resolution is what the patient was told. Letting it be rewritten later would leave the
    // clinic unable to show what it said.
    requestRepo.findById.mockResolvedValue({
      ...(openRequest('erasure') as object),
      status: 'refused',
    } as never);

    const result = await resolveDataRequestService(REQUEST_ID, CLINIC_ID, USER_ID, {
      status: 'completed',
      resolution: 'Changed our mind.',
    });

    expect(result.status).toBe(409);
    expect(requestRepo.updateById).not.toHaveBeenCalled();
  });
});
