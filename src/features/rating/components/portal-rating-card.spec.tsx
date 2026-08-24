import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}));

vi.mock('@/features/rating/hooks/use-portal-ratings', () => ({
  usePortalRatings: vi.fn(),
}));

import { PortalRatingCard } from '@/features/rating/components/portal-rating-card';
import { usePortalRatings } from '@/features/rating/hooks/use-portal-ratings';

const ratingsHook = vi.mocked(usePortalRatings);

const PROCEDURE = '507f1f77bcf86cd799439033';

/** What the hook hands back once a rating has been filed — the card then thanks and stops asking. */
const filed = {
  id: '507f1f77bcf86cd799439044',
  procedureId: PROCEDURE,
  doctorScore: 4,
  clinicScore: 5,
  subscores: {
    communication: null,
    cleanliness: null,
    painManagement: null,
    resultSatisfaction: null,
  },
  comment: '',
  submittedAt: '2026-08-09T12:00:00.000Z',
  isEditable: true,
  clinicResponse: '',
};

const state = (over: Partial<ReturnType<typeof usePortalRatings>> = {}) => ({
  ratable: [
    {
      procedureId: PROCEDURE,
      manipulationType: 'rhinoplasty',
      operatorName: 'Gagua',
      completedOn: '2026-08-01T00:00:00.000Z',
    },
  ],
  isLoading: false,
  isSaving: false,
  hasError: false,
  submitted: null,
  submit: vi.fn(),
  ...over,
});

/** The five stars are radios, so "give the doctor N" is one query in both pickers. */
const stars = (label: string) =>
  screen.getByRole('radiogroup', { name: label }).querySelectorAll('button');

describe('PortalRatingCard', () => {
  /*
    Reduced to its two star questions. It carried four optional detail scores behind a fold and a
    free-text box beneath them, which is six things to answer at the end of a recovery — and
    everything past the second question cost completions rather than adding signal.
  */
  describe('the form is two questions', () => {
    it('offers exactly two star pickers', () => {
      ratingsHook.mockReturnValue(state());

      render(<PortalRatingCard />);

      expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
    });

    it('has no comment box', () => {
      ratingsHook.mockReturnValue(state());

      render(<PortalRatingCard />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('has no way to open the detail scores', () => {
      ratingsHook.mockReturnValue(state());

      render(<PortalRatingCard />);

      expect(screen.queryByText(/addDetail/)).not.toBeInTheDocument();
      expect(screen.queryByText(/subscore_/)).not.toBeInTheDocument();
    });
  });

  it('submits only the procedure and the two scores', async () => {
    const submit = vi.fn();
    ratingsHook.mockReturnValue(state({ submit }));

    render(<PortalRatingCard />);
    fireEvent.click(stars('doctorScore:Gagua')[3]);
    fireEvent.click(stars('clinicScore')[4]);
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        procedureId: PROCEDURE,
        doctorScore: 4,
        clinicScore: 5,
      })
    );
  });

  /** Both stars are required: a half-answered rating is not a data point. */
  describe('submission is blocked until both are given', () => {
    it.each([
      ['neither', [] as number[]],
      ['only the doctor', [0]],
      ['only the clinic', [1]],
    ])('stays disabled with %s answered', (_case, which) => {
      ratingsHook.mockReturnValue(state());

      render(<PortalRatingCard />);
      const groups = ['doctorScore:Gagua', 'clinicScore'];
      for (const index of which) fireEvent.click(stars(groups[index])[2]);

      expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled();
    });

    it('enables once both are given', () => {
      ratingsHook.mockReturnValue(state());

      render(<PortalRatingCard />);
      fireEvent.click(stars('doctorScore:Gagua')[0]);
      fireEvent.click(stars('clinicScore')[0]);

      expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled();
    });
  });

  /** Asked once, at the end, and never again. */
  it('thanks the patient instead of asking twice', () => {
    ratingsHook.mockReturnValue(state({ submitted: filed, ratable: [] }));

    render(<PortalRatingCard />);

    expect(screen.getByText('thanks')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no finished plan to rate', () => {
    ratingsHook.mockReturnValue(state({ ratable: [] }));

    const { container } = render(<PortalRatingCard />);

    expect(container).toBeEmptyDOMElement();
  });
});
