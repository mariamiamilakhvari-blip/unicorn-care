import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Control, useWatch } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

vi.mock('@/features/recovery-guide/hooks/use-procedure-guide', () => ({
  useProcedureGuide: vi.fn(),
}));

/*
  The field arrays are replaced with probes that print what the form is holding. The assertions
  below are about which content reaches the editor, and the real inputs would only obscure it.
*/
type ProbeProps = { control: Control<RecoveryGuideFormType> };

vi.mock('@/features/recovery-guide/components/expected-fields', () => ({
  ExpectedFields: ({ control }: ProbeProps) => {
    const rows = useWatch({ control, name: 'expected' }) ?? [];
    return <div data-testid="expected">{rows.map(row => row.title).join(' | ')}</div>;
  },
}));

vi.mock('@/features/recovery-guide/components/warning-fields', () => ({
  WarningFields: ({ control }: ProbeProps) => {
    const rows = useWatch({ control, name: 'warning' }) ?? [];
    return (
      <div data-testid="warning">
        {rows.map(row => `${row.title}@${row.durationDays}`).join(' | ')}
      </div>
    );
  },
}));

import { CarePlanGuideSection } from '@/features/recovery-guide/components/care-plan-guide-section';
import { useProcedureGuide } from '@/features/recovery-guide/hooks/use-procedure-guide';
import { RecoveryGuideFormType } from '@/features/recovery-guide/validations/recovery-guide.validation';

const guideHook = vi.mocked(useProcedureGuide);

const state = (overrides: Partial<ReturnType<typeof useProcedureGuide>> = {}) => ({
  guide: null,
  isLoading: false,
  isPending: false,
  savedAt: null,
  error: null,
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

function open(manipulationType: string, overrides = {}) {
  const current = state(overrides);
  guideHook.mockReturnValue(current);
  render(<CarePlanGuideSection manipulationType={manipulationType} locale="en" />);
  return current;
}

const expectedText = () => screen.getByTestId('expected').textContent ?? '';
const warningText = () => screen.getByTestId('warning').textContent ?? '';

/** The generic surgical baseline's opening line, which is what a stale default renders. */
const BASELINE = 'Swelling and bruising around the treated area';

describe('CarePlanGuideSection — what the editor opens on', () => {
  /*
    Blank, deliberately. A clinician opening an empty editor writes what they mean; one opening a
    filled editor reads text somebody else wrote and presses save.
  */
  it('opens empty when the clinic has written nothing', () => {
    open('rhinoplasty');

    expect(expectedText()).toBe('');
    expect(warningText()).toBe('');
  });

  it.each(['liposuction', 'some_new_operation'])('opens empty for %s too', key => {
    open(key);

    expect(expectedText()).toBe('');
  });

  /* A platform default is template text under another name, so it is not pre-filled either. */
  it('does not pre-fill from a platform default', () => {
    open('rhinoplasty', {
      guide: {
        isDefault: true,
        isPublished: false,
        expected: [{ title: BASELINE, description: '', fromDay: 0, toDay: 21 }],
        warning: [],
      } as never,
    });

    expect(expectedText()).toBe('');
  });

  /*
    The editor presents the loaded template and nothing about it. The explanatory panel and the
    reset control are both gone: the fields are the answer, and a clinic that wants different
    content edits the fields.
  */
  it('renders no explanatory template panel', () => {
    open('rhinoplasty');

    for (const key of ['templateHeading', 'templateGeneral', 'templateSpecific']) {
      expect(screen.queryByText(key)).not.toBeInTheDocument();
    }
  });

  /* A clinic's own guide is still never replaced by a template, now or on any later render. */
  it('never overwrites the clinic’s own guide', () => {
    open('rhinoplasty', {
      guide: {
        isDefault: false,
        isPublished: true,
        expected: [{ title: 'Ours', description: '', fromDay: 0, toDay: 7 }],
        warning: [],
      } as never,
    });

    expect(expectedText()).toBe('Ours');
  });

  /* A clinic's own guide is the one thing here anybody at this clinic wrote. It always wins. */
  it('loads the clinic’s own guide untouched', () => {
    open('rhinoplasty', {
      guide: {
        isDefault: false,
        isPublished: true,
        expected: [{ title: 'Ours', description: '', fromDay: 0, toDay: 7 }],
        warning: [],
      } as never,
    });

    expect(expectedText()).toBe('Ours');
  });

  /* A stored window becomes its length: the editor asks how long, not from when. */
  it('shows a stored window as a duration', () => {
    open('rhinoplasty', {
      guide: {
        isDefault: false,
        isPublished: true,
        expected: [],
        warning: [
          { title: 'Fever', description: '', severity: 'urgent', fromDay: 0, toDay: 60 },
        ],
      } as never,
    });

    expect(warningText()).toBe('Fever@60');
  });
});

/**
 * The way back from legacy content. A clinic guide written years ago, or a line somebody typed
 * once and should not have, needs a route to the reviewed template that is not deleting rows by
 * hand.
 */
describe('CarePlanGuideSection — resetting to the template', () => {
  const ownGuide = {
    isDefault: false,
    isPublished: true,
    expected: [{ title: 'Legacy line', description: '', fromDay: 0, toDay: 7 }],
    warning: [],
  } as never;

  it('is offered even when the clinic has written its own guide', () => {
    open('rhinoplasty', { guide: ownGuide });

    expect(screen.getByText('resetToTemplate')).toBeInTheDocument();
  });

  it('replaces the clinic’s content on a single click', () => {
    open('rhinoplasty', { guide: ownGuide });
    expect(expectedText()).toBe('Legacy line');

    fireEvent.click(screen.getByText('resetToTemplate'));

    expect(expectedText()).toContain('Mild nasal congestion');
    expect(expectedText()).not.toContain('Legacy line');
  });

  /* Fills an empty editor too — the only route to the template now that nothing pre-fills. */
  it('loads the template into an empty editor', () => {
    open('rhinoplasty');
    expect(expectedText()).toBe('');

    fireEvent.click(screen.getByText('resetToTemplate'));

    expect(expectedText()).toContain('Mild nasal congestion');
  });

  /* The template's windows arrive as lengths, since that is the only field left to hold them. */
  it('brings the template in as durations', () => {
    open('rhinoplasty');

    fireEvent.click(screen.getByText('resetToTemplate'));

    expect(warningText()).toMatch(/@\d+/);
    expect(warningText()).not.toContain('@0-');
  });

  it('loads the general draft for an unmapped procedure', () => {
    open('some_new_operation', { guide: ownGuide });

    fireEvent.click(screen.getByText('resetToTemplate'));

    expect(expectedText()).toContain(BASELINE);
  });

  /*
    The click is not the destructive act. It refills the form; what is stored changes when the
    clinic presses save, so leaving without saving keeps the stored guide exactly as it was.
  */
  it('changes nothing stored until the clinic saves', async () => {
    const current = open('rhinoplasty', { guide: ownGuide });

    fireEvent.click(screen.getByText('resetToTemplate'));

    await waitFor(() => expect(current.save).not.toHaveBeenCalled());
  });
});
