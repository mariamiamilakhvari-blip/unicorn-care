import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/care-plan/repository/reminder-occurrence.repository', () => ({
  reminderOccurrenceRepository: {
    findByPatientAndRange: vi.fn(),
    findByIdForPatient: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { findActiveByPatient: vi.fn() },
}));

vi.mock('@/features/clinic/repository/clinic.repository', () => ({
  clinicRepository: { findById: vi.fn() },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: { findById: vi.fn() },
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { reminderOccurrenceRepository } from '@/features/care-plan/repository/reminder-occurrence.repository';
import { ReminderOccurrenceDocument } from '@/features/care-plan/schema/reminder-occurrence.schema';
import { getPortalPlanService } from '@/features/care-plan/service/patient-portal.service';
import { PortalPlanView } from '@/features/care-plan/types/portal.types';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { clock } from '@/shared/lib/clock';

const occurrences = vi.mocked(reminderOccurrenceRepository);
const plans = vi.mocked(carePlanRepository);
const clinics = vi.mocked(clinicRepository);
const patients = vi.mocked(patientRepository);

const CLINIC = '507f1f77bcf86cd799439022';
const PATIENT = '507f1f77bcf86cd799439011';

/** Tbilisi is UTC+4 year round, so every expectation below is a plain four-hour offset. */
const NOW = new Date('2026-08-11T06:00:00.000Z');

type OccurrenceOverrides = Partial<ReminderOccurrenceDocument> & { id?: string };

function occurrence({ id = '507f1f77bcf86cd799439001', ...rest }: OccurrenceOverrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(id),
    kind: 'medication',
    title: 'Nurofen — 500',
    body: '',
    intensity: null,
    // A 09:30 Tbilisi dose with a five-minute lead: sent 05:25 UTC, taken 05:30 UTC.
    dueAt: new Date('2026-08-11T05:25:00.000Z'),
    scheduledAt: new Date('2026-08-11T05:30:00.000Z'),
    status: 'pending',
    ...rest,
  } as ReminderOccurrenceDocument;
}

async function portal(): Promise<PortalPlanView> {
  const { data } = await getPortalPlanService(PATIENT, CLINIC);
  return data as PortalPlanView;
}

describe('getPortalPlanService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    clinics.findById.mockResolvedValue({ timezone: 'Asia/Tbilisi' } as never);
    // No zone of their own: the patient has never opened the portal, so the clinic's is in force.
    patients.findById.mockResolvedValue({ timezone: '' } as never);
    plans.findActiveByPatient.mockResolvedValue([] as never);
    occurrences.findByPatientAndRange.mockResolvedValue([occurrence()] as never);
  });

  /**
   * The bug this pins: the portal printed `dueAt`, so a five-minute reminder lead moved the dose
   * itself. A lead is an instruction to the dispatcher and must never reach the patient as a
   * different intake time.
   */
  it('reports the prescribed time, not the moment the reminder is sent', async () => {
    const view = await portal();
    const [item] = view.days[0].occurrences;

    expect(item.scheduledAt).toBe('2026-08-11T05:30:00.000Z');
    expect(item.dueAt).toBe('2026-08-11T05:25:00.000Z');
  });

  it("hands the client the clinic's zone until the patient has one of their own", async () => {
    const view = await portal();

    expect(view.timeZone).toBe('Asia/Tbilisi');
    expect(view.todayKey).toBe('2026-08-11');
  });

  /**
   * The patient who flew home. Their rows were rebuilt against Amsterdam when the portal reported
   * the move, and this is the other half: the view has to render them in the zone they are in, or
   * a correctly rebuilt 09:30 dose would still be printed as 07:30.
   */
  it('renders in the patient’s own zone once the portal has learned it', async () => {
    patients.findById.mockResolvedValue({ timezone: 'Europe/Amsterdam' } as never);

    expect((await portal()).timeZone).toBe('Europe/Amsterdam');
  });

  /** A patient's zone comes from their browser, so it gets the same revalidation as the clinic's. */
  it('ignores an unusable patient zone rather than breaking the view', async () => {
    patients.findById.mockResolvedValue({ timezone: 'Amsterdam' } as never);

    expect((await portal()).timeZone).toBe('Asia/Tbilisi');
  });

  /** An invalid zone is a clinic settings problem; it must not blank a patient's plan. */
  it('falls back to the default zone when the clinic holds an invalid one', async () => {
    clinics.findById.mockResolvedValue({ timezone: 'Tbilisi' } as never);

    expect((await portal()).timeZone).toBe('Asia/Tbilisi');
  });

  /**
   * 01:00 in Tbilisi is 21:00 the previous day in UTC. Grouping on the UTC day filed that dose
   * under yesterday, where a patient looking at today's list would never see it.
   */
  it('files a dose under the day it is taken in the clinic zone', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({
        dueAt: new Date('2026-08-11T21:00:00.000Z'),
        scheduledAt: new Date('2026-08-11T21:00:00.000Z'),
      }),
    ] as never);

    expect((await portal()).days[0].date).toBe('2026-08-12');
  });

  it('orders a day by the time each dose is taken', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({ id: '507f1f77bcf86cd799439002', title: 'evening', scheduledAt: new Date('2026-08-11T14:00:00.000Z') }),
      occurrence({ id: '507f1f77bcf86cd799439003', title: 'morning', scheduledAt: new Date('2026-08-11T05:30:00.000Z') }),
    ] as never);

    expect((await portal()).days[0].occurrences.map(item => item.title)).toEqual([
      'morning',
      'evening',
    ]);
  });

  /**
   * The checkup card is keyed off the appointment, not its reminder. Those are a day apart by
   * default, so filtering on `dueAt` hid the appointment for the final 24 hours before it.
   */
  it('keeps showing an appointment whose reminder has already gone out', async () => {
    const checkup = occurrence({
      kind: 'checkup',
      title: 'Visit to doctor',
      dueAt: new Date('2026-08-10T10:00:00.000Z'),
      scheduledAt: new Date('2026-08-11T10:00:00.000Z'),
    });
    occurrences.findByPatientAndRange.mockResolvedValue([checkup] as never);

    expect((await portal()).nextCheckup?.scheduledAt).toBe('2026-08-11T10:00:00.000Z');
  });

  it('drops an appointment once it has actually happened', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({
        kind: 'checkup',
        dueAt: new Date('2026-08-09T10:00:00.000Z'),
        scheduledAt: new Date('2026-08-10T10:00:00.000Z'),
      }),
    ] as never);

    expect((await portal()).nextCheckup).toBeNull();
  });

  /** Rows written before `scheduledAt` existed carry no lead anywhere — `dueAt` is all there is. */
  it('falls back to the send time for a row written before scheduledAt existed', async () => {
    occurrences.findByPatientAndRange.mockResolvedValue([
      occurrence({ scheduledAt: null }),
    ] as never);

    expect((await portal()).days[0].occurrences[0].scheduledAt).toBe('2026-08-11T05:25:00.000Z');
  });

  it('404s when the clinic is gone', async () => {
    clinics.findById.mockResolvedValue(null as never);

    const { status } = await getPortalPlanService(PATIENT, CLINIC);
    expect(status).toBe(404);
  });
});
