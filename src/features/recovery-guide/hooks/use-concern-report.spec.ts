import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib/http', () => ({
  http: { post: vi.fn() },
}));

import { CONFIRMATION_MS, useConcernReport } from '@/features/recovery-guide/hooks/use-concern-report';
import { http } from '@/shared/lib/http';

const post = vi.mocked(http.post);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const REDNESS = {
  warningTitle: 'redness',
  severity: 'call_clinic',
  note: '',
  contactMethod: 'phone',
  contactPhone: '',
} as const;

/**
 * Filing a concern, as many times as a recovery needs.
 *
 * The state this replaces latched: one report and the escalation control became a confirmation
 * for the rest of the session, so a patient whose symptom changed an hour later had to reload the
 * page to say so. A recovery is days long, and the second thing someone notices matters as much
 * as the first.
 */
describe('useConcernReport', () => {
  it('posts the report as one payload', async () => {
    post.mockResolvedValueOnce({} as never);

    const { result } = renderHook(() => useConcernReport());
    await act(() => result.current.send({ ...REDNESS, note: 'since last night' }));

    expect(post).toHaveBeenCalledWith('/patient-portal/symptom-reports', {
      warningTitle: 'redness',
      severity: 'call_clinic',
      note: 'since last night',
      contactMethod: 'phone',
      contactPhone: '',
    });
  });

  it('confirms, then clears the confirmation on its own', async () => {
    post.mockResolvedValueOnce({} as never);

    const { result } = renderHook(() => useConcernReport());
    await act(() => result.current.send(REDNESS));

    expect(result.current.justSent).toBe(true);

    act(() => {
      vi.advanceTimersByTime(CONFIRMATION_MS);
    });

    expect(result.current.justSent).toBe(false);
  });

  it('accepts a second report straight after the first', async () => {
    post.mockResolvedValue({} as never);

    const { result } = renderHook(() => useConcernReport());
    await act(() => result.current.send(REDNESS));
    await act(() => result.current.send({ ...REDNESS, warningTitle: '', severity: '', note: 'and now this' }));

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.current.justSent).toBe(true);
  });

  it('reports whether the send landed, so the form knows what to clear', async () => {
    post.mockRejectedValueOnce(new Error('NETWORK'));

    const { result } = renderHook(() => useConcernReport());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.send(REDNESS);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('NETWORK');
    // No confirmation on a failure, or the patient waits instead of ringing.
    expect(result.current.justSent).toBe(false);
  });

  /* An empty row costs a clinician the time to open a report and find nothing in it. */
  it('refuses an empty report without a round trip', async () => {
    const { result } = renderHook(() => useConcernReport());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.send({ ...REDNESS, warningTitle: '   ', severity: '', note: '  ' });
    });

    expect(ok).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  /* A send that resolves after the patient has left must not set state on a dead tree. */
  it('drops its pending timer on unmount', async () => {
    post.mockResolvedValueOnce({} as never);

    const { result, unmount } = renderHook(() => useConcernReport());
    await act(() => result.current.send(REDNESS));

    unmount();

    expect(() => vi.advanceTimersByTime(CONFIRMATION_MS)).not.toThrow();
  });
});
