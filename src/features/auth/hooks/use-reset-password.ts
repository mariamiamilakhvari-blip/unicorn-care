'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { http } from '@/shared/lib/http';

export const useResetPassword = (token: string) => {
  const t = useTranslations('auth');
  const { loading, error, setLoading, setError } = useAuthStore();
  /*
    The success state stays on this screen rather than being carried to `/sign-in` in the URL. A
    query flag would need `useSearchParams` inside the login form, which drags a Suspense boundary
    into a page that has no other reason for one — and the confirmation reads better next to the
    form the user just submitted.
  */
  const [changed, setChanged] = useState(false);

  const resetPassword = async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      await http.post('/auth/reset-password', { token, password });
      setChanged(true);
    } catch (caught) {
      /*
        The API answers a dead link with `INVALID_TOKEN`, and the http client puts that code on the
        error's message. It is worth telling apart: "this link has expired" sends the user back to
        request another one, whereas a generic failure invites them to retype the same password
        into the same dead link.
      */
      const expired = caught instanceof Error && caught.message === 'INVALID_TOKEN';
      setError(expired ? t('resetLinkInvalid') : t('resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return { resetPassword, changed, loading, error };
};
