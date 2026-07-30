'use client';

import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { ClinicProfile, RegisterClinicResult } from '@/features/clinic/types/clinic.types';
import {
  ClinicOnlyType,
  ClinicSignUpType,
} from '@/features/clinic/validations/clinic-signup.validation';
import { PRICING_ROUTE } from '@/shared/const/routes.const';
import { http } from '@/shared/lib/http';

type RegisterClinicState = {
  isPending: boolean;
  error: string | null;
  registerClinic: (values: ClinicSignUpType) => Promise<void>;
  attachClinic: (values: ClinicOnlyType) => Promise<void>;
};

export function useRegisterClinic(): RegisterClinicState {
  const router = useRouter();
  const { update } = useSession();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** New clinic + owner, then straight into a session so the dashboard is reachable immediately. */
  const registerClinic = useCallback(
    async (values: ClinicSignUpType) => {
      setIsPending(true);
      setError(null);
      try {
        await http.post<RegisterClinicResult>('/clinic/register', {
          owner: { name: values.name, email: values.email, password: values.password },
          clinic: {
            name: values.clinicName,
            country: values.country,
            city: values.city,
            addressLine: values.addressLine,
            phone: values.clinicPhone,
            taxId: values.taxId,
            locale: values.locale,
            timezone: values.timezone,
          },
        });

        const result = await signIn('credentials', {
          email: values.email,
          password: values.password,
          redirect: false,
        });
        if (result?.error) throw new Error(result.error);

        router.push(PRICING_ROUTE);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
      } finally {
        setIsPending(false);
      }
    },
    [router]
  );

  /**
   * Repair path for an account created through the plain sign-up form. `router.refresh()` alone is
   * not enough — the JWT still carries the old role, so the session has to be re-issued before the
   * dashboard will admit them.
   */
  const attachClinic = useCallback(
    async (values: ClinicOnlyType) => {
      setIsPending(true);
      setError(null);
      try {
        await http.post<ClinicProfile>('/clinic', values);
        // Re-issues the JWT. The `jwt` callback refetches the user, so the new role and clinicId
        // land on the token — without this the dashboard would still bounce them.
        await update();
        router.push(PRICING_ROUTE);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
      } finally {
        setIsPending(false);
      }
    },
    [router, update]
  );

  return { isPending, error, registerClinic, attachClinic };
}
