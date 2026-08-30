import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/recovery-guide/hooks/use-concern-report', () => ({
  useConcernReport: vi.fn(),
}));

import { ConcernReportSection } from '@/features/recovery-guide/components/concern-report-section';
import { useConcernReport } from '@/features/recovery-guide/hooks/use-concern-report';
import { WarningItemView } from '@/features/recovery-guide/types/recovery-guide.types';

const reportHook = vi.mocked(useConcernReport);

const warning = (title: string, severity: WarningItemView['severity']): WarningItemView => ({
  title,
  description: '',
  severity,
  fromDay: 0,
  toDay: 30,
});

/** What the clinic holds. The form offers it back rather than asking for it again. */
const PATIENT_PHONE = '+995 555 12 34 56';

const WARNINGS = [warning('redness', 'call_clinic'), warning('temperature 39', 'urgent')];

const state = (over: Partial<ReturnType<typeof useConcernReport>> = {}) => ({
  isSending: false,
  justSent: false,
  error: null,
  send: vi.fn().mockResolvedValue(true),
  ...over,
});

/** The note field, named so it is not confused with the contact-number input beside it. */
const box = () => screen.getByRole('textbox', { name: 'concernHeading' });
const phoneBox = () => screen.getByLabelText('contactPhoneLabel');
const sendButton = () => screen.getByRole('button', { name: 'concernSubmit' });
const badge = (name: string) => screen.getByRole('button', { name });

/**
 * The portal's one way of telling the clinic something.
 *
 * It replaces two: an "I have this" button beside every warning sign, and a separate free-text
 * card at the foot of the page. Both wrote the same row to the same queue, so the split only made
 * the patient choose which kind of problem theirs was — and left a symptom that is on the list
 * *and* needs a sentence with nowhere to be both.
 */
describe('ConcernReportSection', () => {
  it('offers the clinic’s warning signs as one-tap choices', () => {
    reportHook.mockReturnValue(state());

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);

    expect(badge('redness')).toBeInTheDocument();
    expect(badge('temperature 39')).toBeInTheDocument();
    expect(box()).toBeInTheDocument();
  });

  it('sends a named symptom on its own', async () => {
    const send = vi.fn().mockResolvedValue(true);
    reportHook.mockReturnValue(state({ send }));

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
    fireEvent.click(badge('redness'));
    fireEvent.click(sendButton());

    expect(send).toHaveBeenCalledWith({
      warningTitle: 'redness',
      severity: 'call_clinic',
      note: '',
      contactMethod: 'phone',
      contactPhone: '',
    });
  });

  it('sends free text on its own', () => {
    const send = vi.fn().mockResolvedValue(true);
    reportHook.mockReturnValue(state({ send }));

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
    fireEvent.change(box(), { target: { value: 'Is this normal on day 4?' } });
    fireEvent.click(sendButton());

    expect(send).toHaveBeenCalledWith({
      warningTitle: '',
      severity: '',
      note: 'Is this normal on day 4?',
      contactMethod: 'phone',
      contactPhone: '',
    });
  });

  /*
    The combination the old UI could not express. The "I have this" button filed the report the
    instant it was pressed, so a symptom that was on the clinic's list and also needed a sentence
    had to be sent as two separate things, or as free text that dropped the clinic's own wording.
  */
  it('sends a symptom and a sentence together as one report', () => {
    const send = vi.fn().mockResolvedValue(true);
    reportHook.mockReturnValue(state({ send }));

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
    fireEvent.click(badge('temperature 39'));
    fireEvent.change(box(), { target: { value: 'since last night' } });
    fireEvent.click(sendButton());

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      warningTitle: 'temperature 39',
      severity: 'urgent',
      note: 'since last night',
      contactMethod: 'phone',
      contactPhone: '',
    });
  });

  it('lets a tapped sign be untapped', () => {
    reportHook.mockReturnValue(state());

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
    fireEvent.click(badge('redness'));
    expect(badge('redness')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(badge('redness'));
    expect(badge('redness')).toHaveAttribute('aria-pressed', 'false');
    expect(sendButton()).toBeDisabled();
  });

  it('will not send an empty report', () => {
    const send = vi.fn();
    reportHook.mockReturnValue(state({ send }));

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
    expect(sendButton()).toBeDisabled();

    fireEvent.change(box(), { target: { value: '   ' } });
    expect(sendButton()).toBeDisabled();

    fireEvent.click(sendButton());
    expect(send).not.toHaveBeenCalled();
  });

  /*
    The lockout this refactor exists to remove. The old escalation control was replaced by a
    confirmation for the rest of the session, so a patient whose symptom changed an hour later
    could not say so without reloading.
  */
  it('stays ready after a send, with the field cleared', async () => {
    const send = vi.fn().mockResolvedValue(true);
    reportHook.mockReturnValue(state({ send }));

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
    fireEvent.change(box(), { target: { value: 'first message' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(box()).toHaveValue(''));
    expect(box()).toBeEnabled();

    fireEvent.change(box(), { target: { value: 'second message' } });
    fireEvent.click(sendButton());

    expect(send).toHaveBeenNthCalledWith(2, {
      warningTitle: '',
      severity: '',
      note: 'second message',
      contactMethod: 'phone',
      contactPhone: '',
    });
  });

  it('confirms delivery without taking the form away', () => {
    reportHook.mockReturnValue(state({ justSent: true }));

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);

    expect(screen.getByRole('status')).toHaveTextContent('concernSent');
    expect(box()).toBeInTheDocument();
  });

  /*
    Text survives a failure. Clearing it would throw away what the patient has already typed once,
    at the moment they are most worried and least likely to want to type it again.
  */
  it('keeps what was typed when the send fails', async () => {
    const send = vi.fn().mockResolvedValue(false);
    reportHook.mockReturnValue(state({ send, error: 'ERROR' }));

    render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
    fireEvent.change(box(), { target: { value: 'kept text' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(box()).toHaveValue('kept text');
    expect(screen.getByText('concernFailed')).toBeInTheDocument();
    expect(screen.queryByText('concernSent')).not.toBeInTheDocument();
  });

  /*
    The contact preference, which exists for one patient in particular: the one recovering in
    another country on a SIM the clinic has never seen. The number on file reaches a phone in a
    drawer at home, so the field has to be both pre-filled and editable.
  */
  describe('how the clinic should come back to them', () => {
    it('offers the number the clinic already holds, so nobody types it from memory', () => {
      reportHook.mockReturnValue(state());

      render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);

      expect(phoneBox()).toHaveValue(PATIENT_PHONE);
    });

    /*
      An untouched field sends nothing rather than a copy of the record. The server falls back to
      the patient's own number, which keeps the report in step if the clinic later fixes a typo in
      it — a copy taken at write time would silently keep the old one forever.
    */
    it('sends no number at all when the pre-filled one was left alone', () => {
      const send = vi.fn().mockResolvedValue(true);
      reportHook.mockReturnValue(state({ send }));

      render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
      fireEvent.change(box(), { target: { value: 'a question' } });
      fireEvent.click(sendButton());

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ contactPhone: '', contactMethod: 'phone' })
      );
    });

    it('sends the edited number when the patient is on a different SIM', () => {
      const send = vi.fn().mockResolvedValue(true);
      reportHook.mockReturnValue(state({ send }));

      render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
      fireEvent.change(phoneBox(), { target: { value: '+31 6 1234 5678' } });
      fireEvent.change(box(), { target: { value: 'a question' } });
      fireEvent.click(sendButton());

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ contactPhone: '+31 6 1234 5678' })
      );
    });

    /*
      Kept across sends, unlike the note. A patient abroad is still abroad for the next report, and
      re-picking WhatsApp and re-typing an international number every time is how the field stops
      being used at all.
    */
    it('keeps the preference after a send, because the next report needs it too', async () => {
      const send = vi.fn().mockResolvedValue(true);
      reportHook.mockReturnValue(state({ send }));

      render(<ConcernReportSection warnings={WARNINGS} patientPhone={PATIENT_PHONE} />);
      fireEvent.change(phoneBox(), { target: { value: '+31 6 1234 5678' } });
      fireEvent.change(box(), { target: { value: 'first message' } });
      fireEvent.click(sendButton());

      await waitFor(() => expect(box()).toHaveValue(''));
      expect(phoneBox()).toHaveValue('+31 6 1234 5678');
    });
  });

  /* A clinic with no published guide still has a patient who needs to reach it. */
  it('still takes free text when there are no warning signs', () => {
    const send = vi.fn().mockResolvedValue(true);
    reportHook.mockReturnValue(state({ send }));

    render(<ConcernReportSection warnings={[]} patientPhone={PATIENT_PHONE} />);
    fireEvent.change(box(), { target: { value: 'a question' } });
    fireEvent.click(sendButton());

    expect(send).toHaveBeenCalledWith({
      warningTitle: '',
      severity: '',
      note: 'a question',
      contactMethod: 'phone',
      contactPhone: '',
    });
  });
});
