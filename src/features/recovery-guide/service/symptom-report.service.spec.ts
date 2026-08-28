import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/recovery-guide/repository/symptom-report.repository', () => ({
  symptomReportRepository: {
    findAllByClinic: vi.fn(),
    countOpenForClinic: vi.fn(),
    create: vi.fn(),
    findByPatient: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('@/features/patient/repository/patient.repository', () => ({
  patientRepository: {
    findManyByIds: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('@/features/procedure/repository/procedure.repository', () => ({
  procedureRepository: { findAllByPatient: vi.fn() },
}));

vi.mock('@/features/care-plan/repository/care-plan.repository', () => ({
  carePlanRepository: { findActiveByPatient: vi.fn() },
}));

vi.mock('@/features/notifications/service/symptom-alert.service', () => ({
  sendSymptomAlertService: vi.fn(),
}));

import { carePlanRepository } from '@/features/care-plan/repository/care-plan.repository';
import { sendSymptomAlertService } from '@/features/notifications/service/symptom-alert.service';
import { patientRepository } from '@/features/patient/repository/patient.repository';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { symptomReportRepository } from '@/features/recovery-guide/repository/symptom-report.repository';
import {
  createSymptomReportService,
  listSymptomReportsService,
} from '@/features/recovery-guide/service/symptom-report.service';
import { ERASED_PLACEHOLDER } from '@/shared/const/retention.const';

const reports = vi.mocked(symptomReportRepository);
const patients = vi.mocked(patientRepository);
const plans = vi.mocked(carePlanRepository);
const procedures = vi.mocked(procedureRepository);
const alert = vi.mocked(sendSymptomAlertService);

const CLINIC_ID = '507f1f77bcf86cd799439011';
const PATIENT_A = '507f1f77bcf86cd799439022';
const PATIENT_B = '507f1f77bcf86cd799439033';
const PATIENT_C = '507f1f77bcf86cd799439044';

const report = (id: string, patientId: string) => ({
  _id: { toString: () => id },
  patientId: { toString: () => patientId },
  procedureId: null,
  warningTitle: 'temperature 39',
  severity: 'call_clinic',
  note: '',
  status: 'needs_review',
  clinicNote: '',
  createdAt: new Date('2026-08-26T07:17:00.000Z'),
});

const patient = (id: string, over: Record<string, unknown> = {}) => ({
  _id: { toString: () => id },
  firstName: 'Mariam',
  lastName: 'Amilakhvari',
  phone: '+995 555 12 34 56',
  ...over,
});

/**
 * The clinic's review queue, and the one question it has to answer before anybody can act:
 * whose symptom is this.
 *
 * The queue used to carry a title and a timestamp, so a card reading "temperature 39" sent the
 * reader off to find the patient by hand. What is pinned here is that the name and number arrive
 * with the report, that resolving them costs one query however long the queue is, and that a
 * report whose patient has gone is still shown rather than quietly dropped.
 */
describe('listSymptomReportsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    reports.countOpenForClinic.mockResolvedValue(0);
    patients.findManyByIds.mockResolvedValue([]);
  });

  it('carries the name and phone of the patient who filed each report', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([report('r1', PATIENT_A)] as never);
    patients.findManyByIds.mockResolvedValueOnce([patient(PATIENT_A)] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as { items: Array<{ patient: unknown }> };

    expect(items[0].patient).toEqual({
      id: PATIENT_A,
      name: 'Mariam Amilakhvari',
      phone: '+995 555 12 34 56',
    });
  });

  /*
    One query for the whole queue, not one per row. This runs on every dashboard load and the
    queue has no upper bound, so a per-row lookup would put an unbounded number of round trips
    behind the clinic's first screen. Two reports from the same patient ask for that id once.
  */
  it('resolves every patient in a single lookup, asking for each id once', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([
      report('r1', PATIENT_A),
      report('r2', PATIENT_B),
      report('r3', PATIENT_A),
    ] as never);
    patients.findManyByIds.mockResolvedValueOnce([
      patient(PATIENT_A),
      patient(PATIENT_B, { firstName: 'Nino', lastName: 'Beridze' }),
    ] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as { items: Array<{ patient: { name: string } | null }> };

    expect(patients.findManyByIds).toHaveBeenCalledTimes(1);
    expect(patients.findManyByIds).toHaveBeenCalledWith([PATIENT_A, PATIENT_B], CLINIC_ID);
    expect(items.map(item => item.patient?.name)).toEqual([
      'Mariam Amilakhvari',
      'Nino Beridze',
      'Mariam Amilakhvari',
    ]);
  });

  /*
    The lookup is clinic-scoped, so another clinic's patient id resolves to nothing rather than to
    a name. The report still appears — a symptom vanishing from a review queue is the failure this
    queue exists to prevent, and it is the worse of the two outcomes by a distance.
  */
  it('keeps a report whose patient record has gone, and says so with a null', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([report('r1', PATIENT_A)] as never);
    patients.findManyByIds.mockResolvedValueOnce([] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as { items: Array<{ patient: unknown; warningTitle: string }> };

    expect(items).toHaveLength(1);
    expect(items[0].warningTitle).toBe('temperature 39');
    expect(items[0].patient).toBeNull();
  });

  /*
    An erased patient reads as no name, never as the literal placeholder. `[ERASED] [ERASED]` on a
    symptom card looks like a rendering fault, and the reader has to work out that it means the
    patient exercised a right rather than that the page broke. The clinical log is retained after
    the identity around it is cleared, which is why the row is here at all.
  */
  it('shows an erased patient as nameless rather than as the placeholder', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([report('r1', PATIENT_A)] as never);
    patients.findManyByIds.mockResolvedValueOnce([
      patient(PATIENT_A, {
        firstName: ERASED_PLACEHOLDER,
        lastName: ERASED_PLACEHOLDER,
        phone: '',
      }),
    ] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as { items: Array<{ patient: { name: string; phone: string } }> };

    expect(items[0].patient.name).toBe('');
    expect(items[0].patient.phone).toBe('');
    // The record is still there to open, so the link to it survives the erasure.
    expect(items[0].patient).toHaveProperty('id', PATIENT_A);
  });

  /*
    The pairing is by id, never by position. `findManyByIds` is a `$in` query, and Mongo returns
    `$in` matches in index order rather than in the order the ids were asked for — so any code that
    zipped the two arrays together would hand one patient's name to another patient's symptom the
    moment those orders diverged. Here they are deliberately reversed.
  */
  it('pairs by id even when the database returns patients in another order', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([
      report('r1', PATIENT_A),
      report('r2', PATIENT_B),
    ] as never);
    patients.findManyByIds.mockResolvedValueOnce([
      patient(PATIENT_B, { firstName: 'Nino', lastName: 'Beridze', phone: '+995 111' }),
      patient(PATIENT_A, { firstName: 'Mariam', lastName: 'Amilakhvari', phone: '+995 222' }),
    ] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as {
      items: Array<{ patientId: string; patient: { id: string; name: string; phone: string } }>;
    };

    expect(items[0].patient).toEqual({
      id: PATIENT_A,
      name: 'Mariam Amilakhvari',
      phone: '+995 222',
    });
    expect(items[1].patient).toEqual({ id: PATIENT_B, name: 'Nino Beridze', phone: '+995 111' });
  });

  /*
    Name and phone travel together or the clinic rings the wrong person about the right symptom.
    Asserted as whole tuples per row, so a fix that got the name right and the number off by one
    still fails.
  */
  it('never swaps a name onto another patient’s number', async () => {
    const ids = [PATIENT_A, PATIENT_B, PATIENT_C];
    reports.findAllByClinic.mockResolvedValueOnce([
      report('r1', PATIENT_C),
      report('r2', PATIENT_A),
      report('r3', PATIENT_B),
      report('r4', PATIENT_C),
    ] as never);
    patients.findManyByIds.mockResolvedValueOnce(
      ids.map((id, index) =>
        patient(id, {
          firstName: `First${index}`,
          lastName: `Last${index}`,
          phone: `+99500000000${index}`,
        })
      ) as never
    );

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as {
      items: Array<{ patientId: string; patient: { id: string; name: string; phone: string } }>;
    };

    for (const item of items) {
      const index = ids.indexOf(item.patientId);
      expect(item.patient).toEqual({
        id: item.patientId,
        name: `First${index} Last${index}`,
        phone: `+99500000000${index}`,
      });
    }
  });

  /*
    Real ObjectIds from one clinic differ only in their last characters, and three patients sharing
    one email address is a shape this product explicitly allows. A prefix comparison, or any
    `startsWith`/`includes` creeping into the lookup, would collapse them onto one person.
  */
  it('tells apart ids that differ only in the final character', async () => {
    const near = ['6a8b104157d6b2d42b877431', '6a8b104157d6b2d42b877432'];
    reports.findAllByClinic.mockResolvedValueOnce([
      report('r1', near[0]),
      report('r2', near[1]),
    ] as never);
    patients.findManyByIds.mockResolvedValueOnce([
      patient(near[0], { firstName: 'Nini', lastName: 'Nutsibidze' }),
      patient(near[1], { firstName: 'Tamar', lastName: 'Beridze' }),
    ] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as { items: Array<{ patient: { name: string } }> };

    expect(items.map(item => item.patient.name)).toEqual(['Nini Nutsibidze', 'Tamar Beridze']);
  });

  /*
    A gap must stay a gap. If one report's patient cannot be resolved — erased, or belonging to
    another clinic and so filtered out by the scoped query — the rows around it must keep their own
    people rather than shifting up to fill the hole.
  */
  it('does not shift the neighbours when one patient is missing', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([
      report('r1', PATIENT_A),
      report('r2', PATIENT_B),
      report('r3', PATIENT_C),
    ] as never);
    // B resolves to nothing; A and C must be unaffected.
    patients.findManyByIds.mockResolvedValueOnce([
      patient(PATIENT_A, { firstName: 'Mariam', lastName: 'Amilakhvari' }),
      patient(PATIENT_C, { firstName: 'Nino', lastName: 'Beridze' }),
    ] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as {
      items: Array<{ patientId: string; patient: { name: string } | null }>;
    };

    expect(items.map(item => item.patient?.name ?? null)).toEqual([
      'Mariam Amilakhvari',
      null,
      'Nino Beridze',
    ]);
    expect(items.map(item => item.patientId)).toEqual([PATIENT_A, PATIENT_B, PATIENT_C]);
  });

  /*
    Two reports from the same person resolve to the same person. The id is deduplicated before the
    lookup, and a `Map` built from the result must still answer for every row that asked.
  */
  it('gives both of one patient’s reports that same patient', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([
      report('r1', PATIENT_A),
      report('r2', PATIENT_B),
      report('r3', PATIENT_A),
    ] as never);
    patients.findManyByIds.mockResolvedValueOnce([
      patient(PATIENT_A, { firstName: 'Nini', lastName: 'Nutsibidze', phone: '+995 937985983' }),
      patient(PATIENT_B, { firstName: 'Nino', lastName: 'Beridze', phone: '+995 111' }),
    ] as never);

    const result = await listSymptomReportsService(CLINIC_ID);
    const { items } = result.data as { items: Array<{ patient: { name: string; phone: string } }> };

    expect(items[0].patient).toEqual(items[2].patient);
    expect(items[0].patient.phone).toBe('+995 937985983');
    expect(items[1].patient.phone).toBe('+995 111');
  });

  it('does not query for patients when the queue is empty', async () => {
    reports.findAllByClinic.mockResolvedValueOnce([] as never);

    const result = await listSymptomReportsService(CLINIC_ID);

    expect(result.status).toBe(200);
    expect(patients.findManyByIds).toHaveBeenCalledWith([], CLINIC_ID);
  });
});

/**
 * Filing what a patient wrote.
 *
 * The portal has two ways in — the guide's red-flag button and the "additional complaint or
 * question" card — and both arrive here. What is pinned is that a free-text message is stored as
 * a report like any other, and that it carries the plan the patient was part-way through, because
 * "on day 4 of a 21-day plan" is most of what makes a complaint legible to whoever reads it.
 */
describe('createSymptomReportService', () => {
  const PLAN_ID = '507f1f77bcf86cd799439044';
  const PROCEDURE_ID = '507f1f77bcf86cd799439055';

  beforeEach(() => {
    vi.resetAllMocks();
    alert.mockResolvedValue(undefined as never);
    procedures.findAllByPatient.mockResolvedValue([{ _id: PROCEDURE_ID }] as never);
    plans.findActiveByPatient.mockResolvedValue([{ _id: PLAN_ID }] as never);
    reports.create.mockResolvedValue('r1' as never);
    reports.findByPatient.mockResolvedValue([
      { ...report('r1', PATIENT_A), warningTitle: '', note: 'Is this swelling normal?' },
    ] as never);
    patients.findById.mockResolvedValue(patient(PATIENT_A) as never);
  });

  it('stores a free-text message against the plan the patient is part-way through', async () => {
    const result = await createSymptomReportService(PATIENT_A, CLINIC_ID, {
      warningTitle: '',
      severity: '',
      note: 'Is this swelling normal?',
    });

    expect(result.status).toBe(201);
    expect(reports.create).toHaveBeenCalledWith(
      expect.objectContaining({ planId: PLAN_ID, procedureId: PROCEDURE_ID })
    );
  });

  /*
    A patient can write in before a plan is activated, after one finishes, or with none at all.
    None of those is a reason to refuse the message — the text is the point, the plan is context.
  */
  it('files the message with no plan when the patient has none running', async () => {
    plans.findActiveByPatient.mockResolvedValueOnce([] as never);

    const result = await createSymptomReportService(PATIENT_A, CLINIC_ID, {
      warningTitle: '',
      severity: '',
      note: 'A question',
    });

    expect(result.status).toBe(201);
    expect(reports.create).toHaveBeenCalledWith(expect.objectContaining({ planId: null }));
  });

  /*
    Told, not triaged. The row is filed either way; the alert only stops it waiting in the queue
    until somebody happens to look.
  */
  it('tells the clinic a message has arrived', async () => {
    await createSymptomReportService(PATIENT_A, CLINIC_ID, {
      warningTitle: '',
      severity: '',
      note: 'A question',
    });

    expect(alert).toHaveBeenCalledWith(PATIENT_A, CLINIC_ID, '', '');
  });

  it('returns the exact text the patient wrote', async () => {
    const result = await createSymptomReportService(PATIENT_A, CLINIC_ID, {
      warningTitle: '',
      severity: '',
      note: 'Is this swelling normal?',
    });

    expect((result.data as { note: string }).note).toBe('Is this swelling normal?');
  });
});
