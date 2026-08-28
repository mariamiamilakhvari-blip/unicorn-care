import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/recovery-guide/hooks/use-recovery-guide', () => ({
  useRecoveryGuide: vi.fn(),
}));

vi.mock('@/features/recovery-guide/hooks/use-concern-report', () => ({
  useConcernReport: () => ({
    isSending: false,
    justSent: false,
    error: null,
    send: vi.fn().mockResolvedValue(true),
  }),
}));

import { RecoveryGuidePanel } from '@/features/recovery-guide/components/recovery-guide-panel';
import { useRecoveryGuide } from '@/features/recovery-guide/hooks/use-recovery-guide';
import { PatientGuideView } from '@/features/recovery-guide/types/recovery-guide.types';

const guideHook = vi.mocked(useRecoveryGuide);

const GUIDE = {
  id: 'g1',
  manipulationType: 'mesotherapy',
  locale: 'ka',
  expected: [{ title: 'sweling', description: '', fromDay: 0, toDay: 2 }],
  warning: [
    { title: 'redness', description: '', severity: 'call_clinic', fromDay: 0, toDay: 30 },
  ],
  isPublished: true,
  isDefault: false,
  clinic: { name: 'Gagua', phone: '99532 2 122 122' },
} as PatientGuideView;

const state = (over: Partial<ReturnType<typeof useRecoveryGuide>> = {}) => ({
  guide: null,
  absence: null,
  isLoading: false,
  ...over,
});

/**
 * What a patient sees when their clinic's guidance is not available in their language.
 *
 * Two absences reach this panel and they are not the same fact. `missing` is "nobody wrote one",
 * which is true and worth a sentence. `untranslated` is "one exists, in the other language" — and
 * saying so put a paragraph about publication states in front of somebody who opened the portal
 * to find out whether their swelling is normal.
 */
describe('RecoveryGuidePanel — guidance the patient cannot be shown', () => {
  it('says nothing at all when the guide exists only in the other language', () => {
    guideHook.mockReturnValue(state({ absence: 'untranslated' }));

    render(<RecoveryGuidePanel />);

    expect(screen.queryByText('notTranslated')).not.toBeInTheDocument();
    // Nor the other absence: telling this patient nobody wrote one would simply be false.
    expect(screen.queryByText('noGuide')).not.toBeInTheDocument();
  });

  /*
    Silence is not abandonment. The concern form is the useful next step and reaches the same
    clinic, so it has to survive the case where there is no guidance above it.
  */
  it('still offers the way to reach the clinic', () => {
    guideHook.mockReturnValue(state({ absence: 'untranslated' }));

    render(<RecoveryGuidePanel />);

    expect(screen.getByText('concernHeading')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // The standing safety notice is not an absence and never goes away.
    expect(screen.getByText('emergencyBanner')).toBeInTheDocument();
  });

  /*
    The rule most likely to be "helpfully" undone later, and the reason this panel renders nothing
    rather than the English text it could easily reach: clinic-authored clinical material in a
    language the reader did not choose is not guidance they can act on, and under a "when to
    contact the clinic" heading it is worse than an empty state. `resolveGuideService` refuses to
    serve it; this asserts the panel does not go looking for it either.
  */
  it('does not fall back to the other language’s content', () => {
    guideHook.mockReturnValue(state({ absence: 'untranslated' }));

    render(<RecoveryGuidePanel />);

    expect(screen.queryByText('expectedHeading')).not.toBeInTheDocument();
    expect(screen.queryByText('warningHeading')).not.toBeInTheDocument();
  });

  /* The other absence still speaks, because "nobody has written one" is true and actionable. */
  it('says so when no guide has been written in any language', () => {
    guideHook.mockReturnValue(state({ absence: 'missing' }));

    render(<RecoveryGuidePanel />);

    expect(screen.getByText('noGuide')).toBeInTheDocument();
  });

  it('renders the guidance when there is some', () => {
    guideHook.mockReturnValue(state({ guide: GUIDE }));

    render(<RecoveryGuidePanel />);

    expect(screen.getByText('sweling')).toBeInTheDocument();
    expect(screen.getByText('expectedHeading')).toBeInTheDocument();
    // The warning sign is a one-tap choice on the report form as well as a heading here.
    expect(screen.getAllByText('redness').length).toBeGreaterThan(0);
  });

  it('renders nothing while the guide is still loading', () => {
    guideHook.mockReturnValue(state({ isLoading: true }));

    const { container } = render(<RecoveryGuidePanel />);

    expect(container).toBeEmptyDOMElement();
  });
});
