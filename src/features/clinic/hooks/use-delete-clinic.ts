'use client';

import { signOut } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { DeleteClinicResult } from '@/features/clinic/types/clinic.types';
import { http } from '@/shared/lib/http';

/** Failures the owner can act on; anything else falls back to GENERIC. */
export type DeleteClinicError =
  | 'CONFIRMATION_MISMATCH'
  | 'SUBSCRIPTION_CANCEL_FAILED'
  | 'GENERIC';

const KNOWN_ERRORS: DeleteClinicError[] = ['CONFIRMATION_MISMATCH', 'SUBSCRIPTION_CANCEL_FAILED'];

type DeleteClinicState = {
  deleteClinic: (confirmationName: string) => Promise<void>;
  isPending: boolean;
  error: DeleteClinicError | null;
};

export function useDeleteClinic(): DeleteClinicState {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<DeleteClinicError | null>(null);

  const deleteClinic = useCallback(async (confirmationName: string) => {
    setIsPending(true);
    setError(null);
    try {
      await http.delete<DeleteClinicResult>('/clinic', { confirmationName });

      /*
        The account is gone, so the session points at a user row that no longer exists. Signing out
        explicitly clears the cookie and lands them on the marketing page; without it the next
        request would bounce through the dashboard against a deleted clinic.
      */
      await signOut({ callbackUrl: '/' });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(
        KNOWN_ERRORS.includes(message as DeleteClinicError)
          ? (message as DeleteClinicError)
          : 'GENERIC'
      );
      setIsPending(false);
    }
  }, []);

  return { deleteClinic, isPending, error };
}
