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

type SectionProps = Parameters<typeof CarePlanGuideSection>[0];

/**
 * The plan half is a prop, so it is a spy here. What this file can prove is the contract between
 * the two halves — the order they are written in, and that neither is written alone.
 */
function open(manipulationType: string, overrides = {}, props: Partial<SectionProps> = {}) {
  const current = state(overrides);
  guideHook.mockReturnValue(current);
  const onSavePlan = props.onSavePlan ?? vi.fn().mockResolvedValue(true);
  render(
    <CarePlanGuideSection
      manipulationType={manipulationType}
      locale="en"
      isPlanPending={false}
      planError={null}
      planActions={<button type="button">activatePlan</button>}
      {...props}
      onSavePlan={onSavePlan}
    />
  );
  return { ...current, onSavePlan };
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
 * The header is the heading. Nothing else.
 *
 * It used to carry two notices and a reset-to-template button. All three described the editor's own
 * machinery rather than the patient's recovery, and one of them appeared exactly when the editor was
 * already empty — telling a clinician about content that was not on screen. The template is still
 * the seed service's business; it is no longer a control here.
 */
describe('CarePlanGuideSection — the header', () => {
  it('offers no reset-to-template control', () => {
    open('rhinoplasty', {
      guide: {
        isDefault: false,
        isPublished: true,
        expected: [{ title: 'Legacy line', description: '', fromDay: 0, toDay: 7 }],
        warning: [],
      } as never,
    });

    expect(screen.queryByText('resetToTemplate')).not.toBeInTheDocument();
  });

  /* No standing notice above the fields, in either state the guide can load in. */
  it.each([true, false])('carries no explanatory notice when isDefault is %s', isDefault => {
    open('rhinoplasty', {
      guide: { isDefault, isPublished: true, expected: [], warning: [] } as never,
    });

    expect(screen.queryByText('sharedAcrossPatients')).not.toBeInTheDocument();
    expect(screen.queryByText('usingDefault')).not.toBeInTheDocument();
  });
});


/**
 * Two save buttons for one document is what this replaces. A clinician could write the plan and
 * leave the guide beside it a draft, with nothing on screen saying which button covered which
 * half, and the patient's portal would show a plan explained by stale content.
 */
describe('CarePlanGuideSection — one Save for both halves', () => {
  const clickSave = () => fireEvent.click(screen.getByText('save'));

  it('offers one save control, not one per endpoint', () => {
    open('rhinoplasty');

    expect(screen.getAllByText('save')).toHaveLength(1);
    expect(screen.queryByText('saveGuide')).not.toBeInTheDocument();
  });

  /*
    Order is the whole design. The guide is shared by every patient with this procedure, so it must
    never be updated to describe a plan the server has just refused.
  */
  it('writes the plan first and the guide second', async () => {
    const written: string[] = [];
    const current = open(
      'rhinoplasty',
      {
        save: vi.fn(async () => {
          written.push('guide');
        }),
      },
      {
        onSavePlan: vi.fn(async () => {
          written.push('plan');
          return true;
        }),
      }
    );

    clickSave();

    await waitFor(() => expect(current.save).toHaveBeenCalled());
    expect(written).toEqual(['plan', 'guide']);
  });

  it('leaves the guide untouched when the plan half is refused', async () => {
    const onSavePlan = vi.fn().mockResolvedValue(false);
    const current = open('rhinoplasty', {}, { onSavePlan });

    clickSave();

    await waitFor(() => expect(onSavePlan).toHaveBeenCalled());
    expect(current.save).not.toHaveBeenCalled();
  });

  /* Activation belongs to the plan, and now sits beside the Save that stores what it publishes. */
  it('renders the plan’s own actions beside Save', () => {
    open('rhinoplasty');

    expect(screen.getByText('activatePlan')).toBeInTheDocument();
  });

  /* One button spanning two requests reads as busy until the slower half is finished. */
  it('reads as busy while the plan half is in flight', () => {
    open('rhinoplasty', {}, { isPlanPending: true });

    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('reports the plan’s error where the clinic clicked', () => {
    open('rhinoplasty', {}, { planError: 'INCOMPLETE_PLAN' });

    expect(screen.getByText('INCOMPLETE_PLAN')).toBeInTheDocument();
  });

  /* The guide is written last, so its timestamp is the only honest "both halves landed". */
  it('confirms the save once the guide has landed', () => {
    open('rhinoplasty', { savedAt: 1 });

    expect(screen.getByText('planSaved')).toBeInTheDocument();
  });

  it('withholds the confirmation when the plan half failed', () => {
    open('rhinoplasty', { savedAt: 1 }, { planError: 'INCOMPLETE_PLAN' });

    expect(screen.queryByText('planSaved')).not.toBeInTheDocument();
  });
});
