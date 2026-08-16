'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PATIENT_PORTAL_ROUTE } from '@/shared/const/routes.const';
import { http } from '@/shared/lib/http';

/**
 * Spends the emailed link and lands the patient in their portal.
 *
 * A full navigation rather than a router push: the session arrives as a `Set-Cookie` on the POST
 * response, and the portal is rendered on the server behind a cookie the client router would not
 * have picked up yet.
 */
export const usePortalLogin = (token: string) => {
  const t = useTranslations('portal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      await http.post('/patient-portal/redeem', { token });
      window.location.assign(PATIENT_PORTAL_ROUTE);
    } catch {
      // The thrown message is an internal code, never something to show a patient.
      setError(t('portalLoginFailed'));
      setLoading(false);
    }
  };

  return { openPortal, loading, error };
};
