import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/notifications/hooks/use-install-prompt', () => ({
  isIosDevice: vi.fn(() => false),
  isStandalone: vi.fn(() => true),
}));

vi.mock('@/shared/lib/http', () => ({ http: { post: vi.fn() } }));

import { isIosDevice, isStandalone } from '@/features/notifications/hooks/use-install-prompt';
import { usePushSubscription } from '@/features/notifications/hooks/use-push-subscription';

const iosDevice = vi.mocked(isIosDevice);
const standalone = vi.mocked(isStandalone);

const requestPermission = vi.fn();

/** A browser that can do push: service worker, push manager, Notification, no existing sub. */
function givePushCapableWindow() {
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn() },
      }),
    },
  });
  vi.stubGlobal('PushManager', class {});
}

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    iosDevice.mockReturnValue(false);
    standalone.mockReturnValue(true);
    requestPermission.mockResolvedValue('granted');
    givePushCapableWindow();
  });

  afterEach(() => vi.unstubAllGlobals());

  /*
    A drive-by permission prompt gets dismissed permanently and the browser will not let the app
    ask again, so nothing may prompt on mount. `enable` exists precisely so the request is tied to
    a real tap.
  */
  it('never prompts on mount', async () => {
    renderHook(() => usePushSubscription());

    await waitFor(() => expect(requestPermission).not.toHaveBeenCalled());
  });

  /**
   * iOS exposes Web Push only to a home-screen-installed PWA. Safari outside it resolves
   * `requestPermission` without showing anything and the subscribe that follows throws — spending
   * the patient's one chance to be asked on a browser that never asked them.
   */
  it('refuses to prompt on iOS outside the installed app', async () => {
    iosDevice.mockReturnValue(true);
    standalone.mockReturnValue(false);

    const { result } = renderHook(() => usePushSubscription());
    await act(async () => {
      await result.current.enable();
    });

    expect(requestPermission).not.toHaveBeenCalled();
    expect(result.current.isIosNeedsInstall).toBe(true);
  });

  /** Installed to the home screen, the same device is a perfectly ordinary push target. */
  it('prompts on iOS once the portal is installed', async () => {
    iosDevice.mockReturnValue(true);
    standalone.mockReturnValue(true);

    const { result } = renderHook(() => usePushSubscription());
    await act(async () => {
      await result.current.enable();
    });

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(result.current.isIosNeedsInstall).toBe(false);
  });

  /** No Push API at all: nothing to report and nothing that could succeed. */
  it('refuses to prompt when the browser has no Notification API', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('PushManager', undefined);

    const { result } = renderHook(() => usePushSubscription());
    await act(async () => {
      await result.current.enable();
    });

    expect(requestPermission).not.toHaveBeenCalled();
    expect(result.current.isSupported).toBe(false);
    expect(result.current.status).toBe('unsupported');
  });

  it('prompts on a capable browser when asked to', async () => {
    const { result } = renderHook(() => usePushSubscription());
    await act(async () => {
      await result.current.enable();
    });

    expect(requestPermission).toHaveBeenCalledOnce();
  });
});
