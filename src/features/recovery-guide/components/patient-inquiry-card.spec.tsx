import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/recovery-guide/hooks/use-patient-inquiry', () => ({
  usePatientInquiry: vi.fn(),
}));

import { PatientInquiryCard } from '@/features/recovery-guide/components/patient-inquiry-card';
import { usePatientInquiry } from '@/features/recovery-guide/hooks/use-patient-inquiry';

const inquiryHook = vi.mocked(usePatientInquiry);

const state = (over: Partial<ReturnType<typeof usePatientInquiry>> = {}) => ({
  isSending: false,
  sentAt: null,
  error: null,
  send: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
  ...over,
});

const box = () => screen.getByRole('textbox');
const submit = () => screen.getByRole('button', { name: 'inquirySubmit' });

/**
 * The way a patient asks their clinic something the guide does not cover.
 *
 * The portal already had a free-text box behind the red "something doesn't feel right" button,
 * which is an alarm and reads as one. What is pinned here is that this box is on the page rather
 * than behind a toggle — somebody who does not know the feature exists has to be able to see it —
 * and that an empty submit cannot reach the clinic's review queue.
 */
describe('PatientInquiryCard', () => {
  it('shows the field without anything having to be opened first', () => {
    inquiryHook.mockReturnValue(state());

    render(<PatientInquiryCard />);

    expect(screen.getByText('inquiryTitle')).toBeInTheDocument();
    expect(box()).toBeInTheDocument();
    expect(submit()).toBeInTheDocument();
  });

  it('sends what the patient wrote', () => {
    const send = vi.fn().mockResolvedValue(undefined);
    inquiryHook.mockReturnValue(state({ send }));

    render(<PatientInquiryCard />);
    fireEvent.change(box(), { target: { value: 'Is this swelling normal on day 4?' } });
    fireEvent.click(submit());

    expect(send).toHaveBeenCalledWith('Is this swelling normal on day 4?');
  });

  /*
    An empty row costs a clinician the time to open a report and find nothing in it, on the queue
    that exists so nothing gets missed. Whitespace is what an accidental submit sends.
  */
  it('will not send an empty or blank message', () => {
    const send = vi.fn();
    inquiryHook.mockReturnValue(state({ send }));

    render(<PatientInquiryCard />);
    expect(submit()).toBeDisabled();

    fireEvent.change(box(), { target: { value: '   ' } });
    expect(submit()).toBeDisabled();

    fireEvent.click(submit());
    expect(send).not.toHaveBeenCalled();
  });

  it('confirms delivery and offers the box back', () => {
    const reset = vi.fn();
    inquiryHook.mockReturnValue(state({ sentAt: 1, reset }));

    render(<PatientInquiryCard />);

    expect(screen.getByText('inquirySent')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'inquiryWriteAnother' }));
    expect(reset).toHaveBeenCalled();
  });

  /*
    A patient who believes the clinic has been told may wait instead of ringing, so a failure has
    to say so — and must not be mistaken for the confirmation.
  */
  it('says so when the message did not send', () => {
    inquiryHook.mockReturnValue(state({ error: 'ERROR' }));

    render(<PatientInquiryCard />);

    expect(screen.getByText('inquiryFailed')).toBeInTheDocument();
    expect(screen.queryByText('inquirySent')).not.toBeInTheDocument();
  });

  it('blocks a second submit while one is in flight', () => {
    inquiryHook.mockReturnValue(state({ isSending: true }));

    render(<PatientInquiryCard />);
    fireEvent.change(box(), { target: { value: 'A question' } });

    expect(screen.getByRole('button', { name: 'loading' })).toBeDisabled();
  });
});
