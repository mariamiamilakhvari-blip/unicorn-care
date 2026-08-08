'use client';

import { useCallback, useEffect, useState } from 'react';

import { ClinicRatingListView } from '@/features/rating/types/rating.types';
import { http } from '@/shared/lib/http';

type ClinicRatingsState = {
  data: ClinicRatingListView | null;
  isLoading: boolean;
  hasError: boolean;
  /** The only write a clinic has against a rating. There is no delete, by design. */
  respond: (ratingId: string, response: string) => Promise<boolean>;
};

export function useClinicRatings(): ClinicRatingsState {
  const [data, setData] = useState<ClinicRatingListView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      setData(await http.get<ClinicRatingListView>('/ratings'));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const respond = useCallback(
    async (ratingId: string, response: string) => {
      try {
        await http.post(`/ratings/${ratingId}/response`, { response });
        await reload();
        return true;
      } catch {
        return false;
      }
    },
    [reload]
  );

  return { data, isLoading, hasError, respond };
}
