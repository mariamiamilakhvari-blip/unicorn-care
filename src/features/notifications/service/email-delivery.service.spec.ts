import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/notifications/repository/email-event.repository', () => ({
  emailEventRepository: { create: vi.fn(), existsByProviderId: vi.fn() },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findAllByEmail: vi.fn(), findById: vi.fn(), updateDeliveryState: vi.fn() },
}));

import { emailEventRepository } from '@/features/notifications/repository/email-event.repository';
import {
  clearEmailSuppressionService,
  EmailDeliveryEvent,
  isEmailSuppressed,
  recordEmailDeliveryEventService,
} from '@/features/notifications/service/email-delivery.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { PatientDocument } from '@/features/patient/schema/patient.schema';
import { SOFT_BOUNCE_LIMIT } from '@/shared/const/email-delivery.const';

const events = vi.mocked(emailEventRepository);
const patients = vi.mocked(patientRepository);

const PATIENT_ID = '507f1f77bcf86cd799439011';
const CLINIC_ID = '507f1f77bcf86cd799439022';
const EMAIL = 'patient@example.com';

const patient = (overrides: Partial<PatientDocument> = {}): PatientDocument =>
  ({
    _id: new mongoose.Types.ObjectId(PATIENT_ID),
    clinicId: new mongoose.Types.ObjectId(CLINIC_ID),
    firstName: 'Nino',
    lastName: 'Beridze',
    email: EMAIL,
    emailSuppressedAt: null,
    emailSuppressionReason: '',
    emailSoftBounces: 0,
    ...overrides,
  }) as PatientDocument;

const event = (overrides: Partial<EmailDeliveryEvent> = {}): EmailDeliveryEvent => ({
  kind: 'bounced',
  email: EMAIL,
  bounceType: 'Permanent',
  message: 'mailbox does not exist',
  providerId: 'msg_1',
  occurredAt: new Date('2026-08-08T10:00:00.000Z'),
  ...overrides,
});

const lastPatch = () => patients.updateDeliveryState.mock.calls.at(-1)?.[1];

describe('isEmailSuppressed', () => {
  it('is false for a patient that has never had a problem', () => {
    expect(isEmailSuppressed(patient())).toBe(false);
  });

  it('is true once a suppression timestamp exists', () => {
    expect(isEmailSuppressed(patient({ emailSuppressedAt: new Date() }))).toBe(true);
  });
});

/**
 * These rules decide whether a post-operative patient keeps receiving their reminders, so each is
 * pinned with the reason it is what it is. The recurring theme: stopping too eagerly costs one
 * patient their reminders, and stopping too late costs every clinic on the shared sending domain.
 */
describe('recordEmailDeliveryEventService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    patients.findAllByEmail.mockResolvedValue([patient()]);
    patients.updateDeliveryState.mockResolvedValue(true);
    events.existsByProviderId.mockResolvedValue(false);
    events.create.mockResolvedValue('event-id');
  });

  it('suppresses immediately on a hard bounce', async () => {
    // The mailbox does not exist. Retrying cannot succeed and each attempt costs the domain.
    const result = await recordEmailDeliveryEventService(event());

    expect(result.data).toMatchObject({ suppressed: true, reason: 'hard_bounce' });
    expect(lastPatch()).toMatchObject({ emailSuppressionReason: 'hard_bounce' });
  });

  it('suppresses immediately on a complaint', async () => {
    const result = await recordEmailDeliveryEventService(event({ kind: 'complained' }));

    expect(result.data).toMatchObject({ suppressed: true, reason: 'complaint' });
  });

  it('counts a soft bounce without suppressing', async () => {
    // Temporary by definition — a full mailbox must not stop a patient's medication reminders.
    const result = await recordEmailDeliveryEventService(event({ bounceType: 'Transient' }));

    expect(result.data).toMatchObject({ suppressed: false });
    expect(lastPatch()).toEqual({ emailSoftBounces: 1 });
  });

  it('suppresses once soft bounces reach the threshold', async () => {
    patients.findAllByEmail.mockResolvedValue([patient({ emailSoftBounces: SOFT_BOUNCE_LIMIT - 1 })]);

    const result = await recordEmailDeliveryEventService(event({ bounceType: 'Transient' }));

    expect(result.data).toMatchObject({ suppressed: true, reason: 'soft_bounce' });
  });

  it('treats an unrecognised bounce type as soft', async () => {
    // The conservative direction: suppressing a recoverable address stops a patient's reminders
    // over a transient fault, and a genuinely dead one is caught by the threshold anyway.
    const result = await recordEmailDeliveryEventService(event({ bounceType: 'SomethingNew' }));

    expect(result.data).toMatchObject({ suppressed: false });
  });

  it('resets the soft-bounce run on a delivery', async () => {
    patients.findAllByEmail.mockResolvedValue([patient({ emailSoftBounces: 3 })]);

    await recordEmailDeliveryEventService(event({ kind: 'delivered', bounceType: '' }));

    expect(lastPatch()).toEqual({ emailSoftBounces: 0 });
  });

  it('does not let a delivery lift an existing suppression', async () => {
    /*
      A hard bounce or a complaint is a decision about the address, not one bad day. Clearing it
      because a later message happened to land would resume sending to someone who pressed "spam".
      Only the clinic lifts a suppression.
    */
    patients.findAllByEmail.mockResolvedValue([
      patient({ emailSuppressedAt: new Date(), emailSuppressionReason: 'complaint' }),
    ]);

    const result = await recordEmailDeliveryEventService(event({ kind: 'delivered' }));

    expect(result.data).toMatchObject({ suppressed: true });
    // No write mentions the suppression fields at all — checked across every call rather than the
    // last one, so a future change that clears it in a separate write still fails here.
    const touchedSuppression = patients.updateDeliveryState.mock.calls.some(
      call => 'emailSuppressedAt' in (call[1] ?? {}) || 'emailSuppressionReason' in (call[1] ?? {})
    );
    expect(touchedSuppression).toBe(false);
  });

  it('ignores a repeat of an event it has already recorded', async () => {
    // Webhook delivery is at-least-once; without this one bounce could suppress on its own retry.
    events.existsByProviderId.mockResolvedValue(true);

    const result = await recordEmailDeliveryEventService(event());

    expect(result.data).toMatchObject({ recorded: false });
    expect(events.create).not.toHaveBeenCalled();
    expect(patients.updateDeliveryState).not.toHaveBeenCalled();
  });

  it('ignores an address that belongs to no patient', async () => {
    // The provider also reports on mail this system did not send a patient.
    patients.findAllByEmail.mockResolvedValue([]);

    const result = await recordEmailDeliveryEventService(event());

    expect(result.status).toBe(200);
    expect(events.create).not.toHaveBeenCalled();
  });

  /*
    A shared address. Patients are clinic records rather than logins, so nothing stops the same
    inbox appearing on several — and the `findOne` this replaced picked one of them, which marked
    an arbitrary patient unreachable on their own page while the record whose message actually
    bounced kept being sent to.
  */
  describe('an address held by more than one patient', () => {
    const OTHER_ID = '507f1f77bcf86cd799439033';
    const OTHER_CLINIC = '507f1f77bcf86cd799439044';

    const other = (overrides: Partial<PatientDocument> = {}): PatientDocument =>
      patient({
        _id: new mongoose.Types.ObjectId(OTHER_ID),
        clinicId: new mongoose.Types.ObjectId(OTHER_CLINIC),
        ...overrides,
      });

    const patchFor = (id: string) =>
      patients.updateDeliveryState.mock.calls.find(call => call[0] === id)?.[1];

    it('suppresses every record holding the address, not one of them', async () => {
      patients.findAllByEmail.mockResolvedValue([patient(), other()]);

      const result = await recordEmailDeliveryEventService(event());

      expect(result.data).toMatchObject({ suppressed: true, reason: 'hard_bounce', patients: 2 });
      expect(patchFor(PATIENT_ID)).toMatchObject({ emailSuppressionReason: 'hard_bounce' });
      expect(patchFor(OTHER_ID)).toMatchObject({ emailSuppressionReason: 'hard_bounce' });
    });

    /* The log is per record: "why is this patient suppressed" has to be answerable on each page. */
    it('writes a delivery-log row against each patient, under its own clinic', async () => {
      patients.findAllByEmail.mockResolvedValue([patient(), other()]);

      await recordEmailDeliveryEventService(event());

      expect(events.create).toHaveBeenCalledTimes(2);
      expect(events.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: new mongoose.Types.ObjectId(CLINIC_ID) })
      );
      expect(events.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: new mongoose.Types.ObjectId(OTHER_CLINIC) })
      );
    });

    /*
      The counter measures a consecutive run of failures against one record's own sends. Pooling
      the counts across records would trip the threshold in a fraction of the intended allowance.
    */
    it('keeps the soft-bounce run per patient', async () => {
      patients.findAllByEmail.mockResolvedValue([
        patient({ emailSoftBounces: 0 }),
        other({ emailSoftBounces: SOFT_BOUNCE_LIMIT - 1 }),
      ]);

      const result = await recordEmailDeliveryEventService(event({ bounceType: 'Transient' }));

      expect(patchFor(PATIENT_ID)).toEqual({ emailSoftBounces: 1 });
      expect(patchFor(OTHER_ID)).toMatchObject({ emailSuppressionReason: 'soft_bounce' });
      // One record suppressed is enough for the event to report a suppression.
      expect(result.data).toMatchObject({ suppressed: true, reason: 'soft_bounce' });
    });

    it('resets the run on every record when a delivery lands', async () => {
      patients.findAllByEmail.mockResolvedValue([
        patient({ emailSoftBounces: 2 }),
        other({ emailSoftBounces: 3 }),
      ]);

      await recordEmailDeliveryEventService(event({ kind: 'delivered', bounceType: '' }));

      expect(patchFor(PATIENT_ID)).toEqual({ emailSoftBounces: 0 });
      expect(patchFor(OTHER_ID)).toEqual({ emailSoftBounces: 0 });
    });

    /* One message is one event, however many records hold its address. */
    it('still ignores a repeat of an event it has already recorded', async () => {
      patients.findAllByEmail.mockResolvedValue([patient(), other()]);
      events.existsByProviderId.mockResolvedValue(true);

      const result = await recordEmailDeliveryEventService(event());

      expect(result.data).toMatchObject({ recorded: false, patients: 2 });
      expect(events.create).not.toHaveBeenCalled();
      expect(patients.updateDeliveryState).not.toHaveBeenCalled();
    });
  });

  it('records the address as it was, not as it may later be corrected to', async () => {
    await recordEmailDeliveryEventService(event({ email: 'typo@gmial.com' }));

    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'typo@gmial.com', bounceType: 'hard' })
    );
  });
});

describe('clearEmailSuppressionService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    patients.findById.mockResolvedValue(patient({ emailSuppressedAt: new Date() }));
    patients.updateDeliveryState.mockResolvedValue(true);
  });

  it('lifts the suppression and resets the run', async () => {
    // A full allowance, not one attempt before it trips again.
    const result = await clearEmailSuppressionService(PATIENT_ID, CLINIC_ID);

    expect(result.status).toBe(200);
    expect(lastPatch()).toEqual({
      emailSuppressedAt: null,
      emailSuppressionReason: '',
      emailSoftBounces: 0,
    });
  });

  it('404s for a patient outside the clinic, so one clinic cannot resume another’s sending', async () => {
    patients.findById.mockResolvedValue(null);

    const result = await clearEmailSuppressionService(PATIENT_ID, CLINIC_ID);

    expect(result.status).toBe(404);
    expect(patients.updateDeliveryState).not.toHaveBeenCalled();
  });
});
