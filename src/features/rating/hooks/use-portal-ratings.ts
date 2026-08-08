'use client';

import { useCallback, useEffect, useState } from 'react';

import { RatablePlanView, RatingView } from '@/features/rating/types/rating.types';
import { SubmitRatingType } from '@/features/rating/validations/rating.validation';
import { http } from '@/shared/lib/http';

type PortalRatingsState = {
  ratable: RatablePlanView[];
  isLoading: boolean;
  isSaving: boolean;
  hasError: boolean;
  /** The rating just filed, so the card can confirm it and offer the correction window. */
  submitted: RatingView | null;
  submit: (input: SubmitRatingType) => Promise<boolean>;
};

/**
 * The portal's rating card.
 *
 * Silent on failure by design — no toast, no error row. Nothing clinical depends on a rating, and
 * a patient who has just finished recovery should not be shown a red banner because an optional
 * survey did not save.
 */
export function usePortalRatings(): PortalRatingsState {
  const [ratable, setRatable] = useState<RatablePlanView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [submitted, setSubmitted] = useState<RatingView | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await http.get<{ items: RatablePlanView[] }>('/patient-portal/ratings');
      setRatable(result.items);
    } catch {
      // Nothing to show and nothing to say: the card simply does not appear.
      setRatable([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = useCallback(async (input: SubmitRatingType) => {
    setIsSaving(true);
    setHasError(false);
    try {
      const rating = await http.post<RatingView>('/patient-portal/ratings', input);
      setSubmitted(rating);
      // Dropped from the list rather than refetched: the answer is already known.
      setRatable(current => current.filter(item => item.procedureId !== input.procedureId));
      return true;
    } catch {
      setHasError(true);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { ratable, isLoading, isSaving, hasError, submitted, submit };
}
