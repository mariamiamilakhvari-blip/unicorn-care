'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PortalLinkRequestType } from '@/features/patient/validations/portal-link.validation';
import { http } from '@/shared/lib/http';

/**
 * Local state throughout, and no store: a patient asking for a link is a fact about this one form
 * on this one screen, and there is no patient store on the public side to put it in.
 */
export const usePortalLinkRequest = () => {
  const t = useTranslations('portal');
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLink = async (data: PortalLinkRequestType) => {
    setLoading(true);
    setError(null);
    try {
      await http.post('/patient-portal/request-link', data);
      setRequested(true);
    } catch {
      // The thrown message is an internal code, never something to show a patient.
      setError(t('linkRequestFailed'));
    } finally {
      setLoading(false);
    }
  };

  return { requestLink, requested, loading, error };
};
