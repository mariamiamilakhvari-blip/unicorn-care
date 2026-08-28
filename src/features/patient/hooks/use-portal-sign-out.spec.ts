import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib/http', () => ({
  http: { post: vi.fn() },
}));

import { usePortalSignOut } from '@/features/patient/hooks/use-portal-sign-out';
import { LINK_EXPIRED_ROUTE } from '@/shared/const/routes.const';
import { http } from '@/shared/lib/http';

const post = vi.mocked(http.post);
const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign },
  });
});

/**
 * Leaving a session that turned out to belong to somebody else.
 *
 * The cookie is `httpOnly`, so the clear has to happen on the server — the hook's job is to ask
 * for it and then get the patient off a screen showing another person's plan.
 */
describe('usePortalSignOut', () => {
  it('asks the server to clear the cookie, then leaves for the link request page', async () => {
    post.mockResolvedValueOnce({} as never);

    const { result } = renderHook(() => usePortalSignOut());
    await act(() => result.current.signOut());

    expect(post).toHaveBeenCalledWith('/patient-portal/sign-out', {});
    expect(assign).toHaveBeenCalledWith(LINK_EXPIRED_ROUTE);
  });

  /*
    Leaves even when the clear fails. Someone pressing this has just told us they are looking at
    the wrong person's record; stranding them there because a POST returned 500 is the worse of
    the two failures, and the destination is the page that hands them a real way back in.
  */
  it('leaves anyway when the request fails', async () => {
    post.mockRejectedValueOnce(new Error('NETWORK'));

    const { result } = renderHook(() => usePortalSignOut());
    await act(() => result.current.signOut());

    expect(assign).toHaveBeenCalledWith(LINK_EXPIRED_ROUTE);
  });

  /*
    A hard navigation, not a router push: the session is read on the server, so everything rendered
    from the old one has to be thrown away rather than re-rendered around.
  */
  it('navigates hard rather than through the router', async () => {
    post.mockResolvedValueOnce({} as never);

    const { result } = renderHook(() => usePortalSignOut());
    await act(() => result.current.signOut());

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('reports that it is working so the control can lock', async () => {
    let release: (value: unknown) => void = () => {};
    post.mockReturnValueOnce(new Promise(resolve => (release = resolve)) as never);

    const { result } = renderHook(() => usePortalSignOut());
    expect(result.current.isSigningOut).toBe(false);

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.signOut();
    });
    expect(result.current.isSigningOut).toBe(true);

    await act(async () => {
      release({});
      await pending;
    });
  });
});
