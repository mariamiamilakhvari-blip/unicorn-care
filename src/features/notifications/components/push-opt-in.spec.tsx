import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

vi.mock('@/features/notifications/hooks/use-push-subscription', () => ({
  usePushSubscription: vi.fn(),
}));

vi.mock('@/features/notifications/components/push-denied-notice', () => ({
  PushDeniedNotice: () => <div data-testid="denied-notice" />,
}));

import { PushOptIn } from '@/features/notifications/components/push-opt-in';
import { usePushSubscription } from '@/features/notifications/hooks/use-push-subscription';

const pushHook = vi.mocked(usePushSubscription);

const state = (over: Partial<ReturnType<typeof usePushSubscription>> = {}) => ({
  status: 'idle' as const,
  isSupported: true,
  isIosNeedsInstall: false,
  enable: vi.fn(),
  ...over,
});

describe('PushOptIn', () => {
  /**
   * The bug. An iOS visitor who had not installed the portal met "your browser does not support
   * notifications" above their plan — prominent, unasked-for, and not something that sentence lets
   * them act on.
   */
  describe('a browser that cannot do push', () => {
    it('renders nothing at all', () => {
      pushHook.mockReturnValue(state({ isSupported: false, status: 'unsupported' }));

      const { container } = render(<PushOptIn />);

      expect(container).toBeEmptyDOMElement();
    });

    it('never names the limitation', () => {
      pushHook.mockReturnValue(state({ isSupported: false, status: 'unsupported' }));

      render(<PushOptIn />);

      expect(screen.queryByText('unsupported')).not.toBeInTheDocument();
    });
  });

  /*
    iOS outside the installed app. Web Push reaches only a home-screen PWA there, so there *is*
    something the patient can do — but it costs one line and says nothing until asked.
  */
  describe('iOS Safari outside the installed app', () => {
    it('says nothing about the install until the patient asks', () => {
      pushHook.mockReturnValue(state({ isIosNeedsInstall: true }));

      render(<PushOptIn />);

      expect(screen.queryByText(/iosInstallHint/)).not.toBeInTheDocument();
      expect(screen.queryByText(/addToHomeScreen/)).not.toBeInTheDocument();
    });

    it('explains the install once the patient opens it', () => {
      pushHook.mockReturnValue(state({ isIosNeedsInstall: true }));

      render(<PushOptIn />);
      fireEvent.click(screen.getByRole('button', { name: /enableNotifications/ }));

      expect(screen.getByText(/iosInstallHint/)).toBeInTheDocument();
    });

    /**
     * Safari there resolves `requestPermission` without showing anything and the subscribe that
     * follows throws — spending the patient's one chance to be asked on a browser that never asked.
     */
    it('never requests permission from that tap', () => {
      const enable = vi.fn();
      pushHook.mockReturnValue(state({ isIosNeedsInstall: true, enable }));

      render(<PushOptIn />);
      fireEvent.click(screen.getByRole('button', { name: /enableNotifications/ }));

      expect(enable).not.toHaveBeenCalled();
    });

    it('collapses again on a second tap', () => {
      pushHook.mockReturnValue(state({ isIosNeedsInstall: true }));

      render(<PushOptIn />);
      const toggle = screen.getByRole('button', { name: /enableNotifications/ });

      fireEvent.click(toggle);
      fireEvent.click(toggle);

      expect(screen.queryByText(/iosInstallHint/)).not.toBeInTheDocument();
    });
  });

  describe('a browser that can', () => {
    /** The prompt is only ever raised from a real tap — a drive-by one is dismissed forever. */
    it('offers a button and prompts only when it is pressed', () => {
      const enable = vi.fn();
      pushHook.mockReturnValue(state({ enable }));

      render(<PushOptIn />);
      expect(enable).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /enableNotifications/ }));
      expect(enable).toHaveBeenCalledOnce();
    });

    it('reports itself busy while the prompt is open', () => {
      pushHook.mockReturnValue(state({ status: 'pending' }));

      render(<PushOptIn />);

      expect(screen.getByRole('button', { name: /enabling/ })).toBeDisabled();
    });

    it('confirms once notifications are on, with no button left to press', () => {
      pushHook.mockReturnValue(state({ status: 'enabled' }));

      render(<PushOptIn />);

      expect(screen.getByText('notificationsEnabled')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    /** Permission is a one-way door, so a refusal hands off to the dismissable notice. */
    it('drops to the denied notice once permission is refused', () => {
      pushHook.mockReturnValue(state({ status: 'denied' }));

      render(<PushOptIn />);

      expect(screen.getByTestId('denied-notice')).toBeInTheDocument();
    });
  });
});
