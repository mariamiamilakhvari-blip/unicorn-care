'use client';

import { useEffect, useRef } from 'react';

import { PatientTimezoneResult } from '@/features/patient/types/patient.types';
import { http } from '@/shared/lib/http';

/**
 * Tells the server which zone this device is in, once per mount.
 *
 * Zero-effort by design: a patient a week out of surgery is not asked to confirm anything, and
 * there is no setting to find. The device already knows where it is, and the only thing that
 * should visibly happen is that the times keep saying what the clinic prescribed.
 *
 * `onChanged` fires only when the server says the zone actually moved, which is what makes this
 * cheap enough to run on every portal visit — the plan is re-read on the flight home, and on no
 * other morning.
 *
 * Failure is deliberately silent. A patient who cannot reach this endpoint still has their plan;
 * degrading to the zone already on file shows the old times, which beats an error on the page
 * someone opens to find out whether they have taken their tablets.
 */
export function useTimezoneSync(onChanged: () => void): void {
  /*
    The callback identity changes on every render of a typical caller, and this effect must stay
    keyed to the mount — otherwise the zone is re-posted on every re-render of the portal. The ref
    is written inside an effect rather than during render: React may discard a render, and a ref
    updated in one that never commits is a stale callback.
  */
  const changed = useRef(onChanged);

  useEffect(() => {
    changed.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    let cancelled = false;

    const report = async () => {
      try {
        const result = await http.post<PatientTimezoneResult>('/patient-portal/timezone', {
          timezone,
        });
        if (!cancelled && result.changed) changed.current();
      } catch {
        // See above: the plan is readable without this, so nothing is surfaced.
      }
    };

    void report();

    return () => {
      cancelled = true;
    };
  }, []);
}
