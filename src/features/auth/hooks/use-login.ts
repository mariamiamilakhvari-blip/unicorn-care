'use client';
import { signIn, getSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { User } from '@/features/auth/types/auth.types';
import { LoginType } from '@/features/auth/validations/auth.validation';


export const useLogin = () => {
  const t = useTranslations('auth');
  const { setUser, setLoading, setError } = useAuthStore();

  const handleSession = async (setUserFn: typeof setUser) => {
    const session = await getSession();
    const sessionUser = session?.user as User | undefined;
    if (!sessionUser) return;

    setUserFn({
      id: sessionUser.id ?? '',
      name: sessionUser.name ?? '',
      email: sessionUser.email ?? '',
      role: sessionUser.role ?? 'user',
      avatar: sessionUser.avatar ?? '',
    });

    window.location.href = sessionUser.role === 'admin' ? '/dashboard' : '/';
  };

  const login = async (data: LoginType) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError(t('invalidCredentials'));
        return;
      }

      if (result?.ok) {
        await handleSession(setUser);
      }
    } catch {
      // The thrown message is an internal code, never something to show a clinic.
      setError(t('signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  return { login };
};
