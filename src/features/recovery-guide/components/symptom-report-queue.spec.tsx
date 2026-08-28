import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
  useFormatter: () => ({ dateTime: () => '26 Aug 2026, 07:17' }),
}));

vi.mock('@/features/recovery-guide/hooks/use-symptom-reports', () => ({
  useSymptomReports: vi.fn(),
}));

import { SymptomReportQueue } from '@/features/recovery-guide/components/symptom-report-queue';
import { useSymptomReports } from '@/features/recovery-guide/hooks/use-symptom-reports';
import { SymptomReportView } from '@/features/recovery-guide/types/recovery-guide.types';

const reportsHook = vi.mocked(useSymptomReports);

const PATIENT_ID = '507f1f77bcf86cd799439022';

const report = (over: Partial<SymptomReportView> = {}): SymptomReportView => ({
  id: 'r1',
  patientId: PATIENT_ID,
  patient: { id: PATIENT_ID, name: 'Mariam Amilakhvari', phone: '+995 555 12 34 56' },
  planId: null,
  procedureId: null,
  warningTitle: 'temperature 39',
  severity: '',
  note: '',
  status: 'reviewed',
  clinicNote: '',
  createdAt: '2026-08-26T07:17:00.000Z',
  ...over,
});

const state = (items: SymptomReportView[]) => ({
  reports: items,
  openCount: 0,
  isLoading: false,
  review: vi.fn(),
});

/**
 * The card a clinician reads when a patient reports a symptom.
 *
 * It used to carry the symptom and the time and nothing else, which is a notification you cannot
 * act on: the first question is whose temperature this is, and answering it meant leaving the
 * dashboard. What is pinned here is that the name, a number that dials, and the way to the record
 * are all on the card — and that the two ways of having no patient are said in words rather than
 * left as a blank that reads like a broken page.
 */
describe('SymptomReportQueue', () => {
  it('names the patient, dials the number, and links to the record', () => {
    reportsHook.mockReturnValue(state([report()]));

    render(<SymptomReportQueue />);

    expect(screen.getByText('reportPatient:Mariam Amilakhvari')).toBeInTheDocument();

    const call = screen.getByRole('link', { name: /\+995 555 12 34 56/ });
    // Spaces stripped, or the dialler receives a number it cannot use.
    expect(call).toHaveAttribute('href', 'tel:+995555123456');

    expect(screen.getByRole('link', { name: /openPatient/ })).toHaveAttribute(
      'href',
      `/dashboard/patients/${PATIENT_ID}`
    );

    // The symptom itself is still the thing being reported.
    expect(screen.getByText('temperature 39')).toBeInTheDocument();
  });

  /*
    A dead `tel:` link is worse than none — it looks actionable and does nothing. The same rule the
    patient-facing guide panel follows for the clinic's own number.
  */
  it('states that no number is held rather than rendering a dead tel link', () => {
    reportsHook.mockReturnValue(
      state([report({ patient: { id: PATIENT_ID, name: 'Mariam Amilakhvari', phone: '' } })])
    );

    render(<SymptomReportQueue />);

    expect(screen.getByText('reportNoPhone')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /tel:/ })).not.toBeInTheDocument();
    // The record is still reachable without a phone number.
    expect(screen.getByRole('link', { name: /openPatient/ })).toBeInTheDocument();
  });

  /*
    Erasure clears the identity and keeps the clinical log, so this card outlives the name on it.
    It says which, because a blank line reads as a bug rather than as a right exercised.
  */
  it('says the record was erased, and still links to it', () => {
    reportsHook.mockReturnValue(
      state([report({ patient: { id: PATIENT_ID, name: '', phone: '' } })])
    );

    render(<SymptomReportQueue />);

    expect(screen.getByText('reportPatientErased')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /openPatient/ })).toHaveAttribute(
      'href',
      `/dashboard/patients/${PATIENT_ID}`
    );
  });

  it('says the patient record has gone when there is nothing left to link to', () => {
    reportsHook.mockReturnValue(state([report({ patient: null })]));

    render(<SymptomReportQueue />);

    expect(screen.getByText('reportPatientMissing')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /openPatient/ })).not.toBeInTheDocument();
    // The report is still on screen — a symptom must never drop out of the review queue.
    expect(screen.getByText('temperature 39')).toBeInTheDocument();
  });
});
