import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const locale = vi.hoisted(() => ({ current: 'ka' }));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => locale.current,
}));

import { ProcedureForm } from '@/features/procedure/components/procedure-form';
import { ProcedureView } from '@/features/procedure/types/procedure.types';
import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';

function render_(procedure: ProcedureView | null = null) {
  render(
    <ProcedureForm
      patientId="6a8ab18130e9588d68298165"
      onSubmit={vi.fn()}
      isPending={false}
      procedure={procedure}
    />
  );
}

function open(as: 'ka' | 'en' = 'ka') {
  locale.current = as;
  render_();
  // By name, not by role alone: the anesthesia Select is a combobox too. That the name resolves
  // at all is the FormLabel/FormControl wiring working — the label points at the trigger's id.
  fireEvent.click(screen.getByRole('combobox', { name: 'manipulationType' }));
}

const search = () => screen.getByPlaceholderText('searchProcedure');
const optionLabels = () => screen.getAllByRole('option').map(node => node.textContent?.trim());

function type(query: string) {
  fireEvent.change(search(), { target: { value: query } });
}

/**
 * The catalogue is ninety-two entries, which is what a plain select stopped being usable for.
 *
 * The wiring these assertions exist for is `keywords`: a clinic working in Georgian types `botox`,
 * and a procedure whose Georgian spelling they are unsure of has to still be reachable. Testing it
 * on the form rather than only on the component is deliberate — the component supports keywords,
 * and this is the place that has to actually pass both names to it.
 */
describe('ProcedureForm — searching the procedure catalogue', () => {
  it('offers the whole catalogue before anything is typed', () => {
    open();

    expect(screen.getAllByRole('option')).toHaveLength(PROCEDURE_TYPES.length);
  });

  it('finds a Georgian label from an English query', () => {
    open('ka');

    type('rhinoplasty');

    expect(optionLabels()).toEqual(['რინოპლასტიკა']);
  });

  it('finds an English label from a Georgian query', () => {
    open('en');

    type('რინოპლასტიკა');

    expect(optionLabels()).toEqual(['Rhinoplasty']);
  });

  /* Georgian is the working language; the labels are the ones a clinic reads on the page. */
  it('labels the options in the page’s language', () => {
    open('ka');

    type('liposuction');

    expect(optionLabels()).toEqual(['ლიპოსაქცია']);
  });

  it('labels them in English when the page is', () => {
    open('en');

    type('ლიპოსაქცია');

    expect(optionLabels()).toEqual(['Liposuction']);
  });

  it('reaches the catch-all by either name', () => {
    open('ka');

    type('other');

    expect(optionLabels()).toContain('სხვა');
  });

  it('reports a query that matches nothing', () => {
    open();

    type('qqqq');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('noProcedureFound')).toBeInTheDocument();
  });

  /* One query, one procedure — a search that leaves ten candidates has not helped anybody. */
  it('narrows a common prefix to a workable number', () => {
    open('ka');

    type('პლაზმო');

    expect(screen.getAllByRole('option').length).toBeLessThan(5);
  });
});

/**
 * The reminder lead time this form used to collect, and no longer does.
 *
 * The control was real and did nothing. A procedure's `remindMinutesBefore` never reached the
 * scheduler: `buildOccurrences` takes a dose's lead from the medication or rehab task it belongs
 * to, and a checkup's from its own `remindHoursBefore`. Nothing anywhere read the procedure's. So
 * a clinic could set "send reminders 45 minutes early" on an operation, watch it save, and get
 * reminders at exactly the same times as before.
 *
 * A setting that appears to work and does not is worse than no setting, which is why this is a
 * removal rather than a wiring-up: what the lead time on an *operation* should even mean — early
 * relative to which of the plan's reminders — was never decided, and inventing an answer here
 * would be inventing clinical behaviour.
 */
describe('ProcedureForm — no reminder lead time', () => {
  it('does not offer the field', () => {
    locale.current = 'ka';
    render_();

    expect(screen.queryByLabelText('remindMinutesBefore')).not.toBeInTheDocument();
    expect(screen.queryByText('remindMinutesBeforeHint')).not.toBeInTheDocument();
  });

  /*
    The one number input on this form was the lead time. Anything typed here now is a field a
    human chose to add, not this one coming back by way of a merge.
  */
  it('has no number input left on the form', () => {
    locale.current = 'ka';
    render_();

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  /*
    A procedure saved with a lead time still opens for editing. The value is ignored rather than
    migrated — the stored column keeps whatever it held, and nothing reads it.
  */
  it('still edits a procedure that was saved with one', () => {
    locale.current = 'ka';
    render_({
      _id: '6a8ab18130e9588d68298164',
      patientId: '6a8ab18130e9588d68298163',
      clinicId: '6a8ab18130e9588d68298165',
      performedAt: '2026-08-22T13:00:00.000Z',
      operatorName: 'sofia',
      operatorUserId: null,
      manipulationType: 'rhinoplasty',
      manipulationDetail: '',
      anesthesia: 'local',
      notes: '',
      remindMinutesBefore: 45,
    } as ProcedureView & { remindMinutesBefore: number });

    expect(screen.getByDisplayValue('sofia')).toBeInTheDocument();
    expect(screen.queryByLabelText('remindMinutesBefore')).not.toBeInTheDocument();
  });
});
