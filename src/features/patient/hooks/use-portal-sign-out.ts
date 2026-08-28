'use client';

import { useCallback, useState } from 'react';

import { LINK_EXPIRED_ROUTE } from '@/shared/const/routes.const';
import { http } from '@/shared/lib/http';

type PortalSignOutState = {
  isSigningOut: boolean;
  signOut: () => Promise<void>;
};

/**
 * Drops the portal session on this device and sends the patient to ask for their own link.
 *
 * A hard navigation rather than a router push. The session cookie is read on the server by
 * `patientGuard`, so anything still rendered from the old session has to be thrown away rather
 * than re-rendered around — and `/link-expired` is a public page that must not be reached with a
 * client cache full of somebody else's plan.
 *
 * It navigates even when the request fails. Someone pressing "not you" is telling us they are
 * looking at the wrong person's record, and leaving them on that screen because a POST returned
 * 500 is the worse of the two failures; the destination is the page that hands them a real way in.
 */
export function usePortalSignOut(): PortalSignOutState {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await http.post('/patient-portal/sign-out', {});
    } catch (caught) {
      console.error('[portal] sign-out failed, leaving anyway', caught);
    } finally {
      window.location.assign(LINK_EXPIRED_ROUTE);
    }
  }, []);

  return { isSigningOut, signOut };
}
