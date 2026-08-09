'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { ForgotPasswordType } from '@/features/auth/validations/auth.validation';
import { http } from '@/shared/lib/http';

export const useForgotPassword = () => {
  const t = useTranslations('auth');
  const { loading, error, setLoading, setError } = useAuthStore();
  /*
    Local rather than in the store: "a request went out on this screen" is state of this one form,
    and leaving it in the shared auth store would have the confirmation reappear the next time any
    auth screen mounted.
  */
  const [requested, setRequested] = useState(false);

  const requestReset = async (data: ForgotPasswordType) => {
    setLoading(true);
    setError(null);
    try {
      await http.post('/auth/forgot-password', data);
      setRequested(true);
    } catch {
      // The thrown message is an internal code, never something to show a visitor.
      setError(t('resetRequestFailed'));
    } finally {
      setLoading(false);
    }
  };

  return { requestReset, requested, loading, error };
};
