'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { SignUpType } from '@/features/auth/validations/auth.validation';
import { http } from '@/shared/lib/http';

export const useRegister = () => {
  const t = useTranslations('auth');
  const { setLoading, setError } = useAuthStore();
  const router = useRouter();

  const register = async (data: SignUpType) => {
    setLoading(true);
    setError(null);
    try {
      await http.post('/auth/register', data);
      router.push('/sign-in');
    } catch {
      // The thrown message is an internal code, never something to show a clinic.
      setError(t('registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return { register };
};
