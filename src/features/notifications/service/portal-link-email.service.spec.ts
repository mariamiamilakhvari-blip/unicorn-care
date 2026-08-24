import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib/resend-client', () => ({
  resendClient: { isConfigured: vi.fn(), send: vi.fn() },
}));

import { sendPortalLinkEmailService } from '@/features/notifications/service/portal-link-email.service';
import { resendClient } from '@/shared/lib/resend-client';

const resend = vi.mocked(resendClient);

const input = (over: Record<string, unknown> = {}) => ({
  to: 'patient@example.test',
  locale: 'en' as const,
  clinic: {
    name: 'Unicorn Clinic',
    addressLine: '1 Rustaveli Ave',
    phone: '+995 32 000 0000',
    email: 'hello@clinic.test',
    timezone: 'Asia/Tbilisi',
  },
  portalUrl: 'https://example.test/p/login/tok',
  ttlHours: 24,
  ...over,
});

/** The HTML and the plain-text part must never disagree about how long the link lasts. */
const bothParts = (): string => {
  const sent = resend.send.mock.calls[0][0];
  return `${sent.html} ${sent.text}`;
};

describe('sendPortalLinkEmailService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resend.isConfigured.mockReturnValue(true);
    resend.send.mockResolvedValue({ ok: true } as never);
  });

  /**
   * A month-long link rendered through the hours string read "stops working after 720 hours",
   * which is true and tells the patient nothing. The unit follows the window.
   */
  it('states a month-long link in days', async () => {
    await sendPortalLinkEmailService(input({ ttlHours: 30 * 24 }));

    expect(bothParts()).toContain('30 days');
    expect(bothParts()).not.toContain('720');
  });

  /** The requested link is a day long, and a day is not something anyone calls "1 days". */
  it('states a day-long link in hours', async () => {
    await sendPortalLinkEmailService(input({ ttlHours: 24 }));

    expect(bothParts()).toContain('24 hours');
  });

  /** Georgian carries its own strings for both units, not an English fallback. */
  it('states the window in the patient language', async () => {
    await sendPortalLinkEmailService(input({ locale: 'ka', ttlHours: 30 * 24 }));

    expect(bothParts()).toContain('30 დღე');
  });

  it('reports false rather than throwing when Resend is not configured', async () => {
    resend.isConfigured.mockReturnValue(false);

    expect(await sendPortalLinkEmailService(input())).toBe(false);
    expect(resend.send).not.toHaveBeenCalled();
  });

  it('reports false when the send is rejected', async () => {
    resend.send.mockResolvedValue({ ok: false, statusCode: 422, message: 'bad' } as never);

    expect(await sendPortalLinkEmailService(input())).toBe(false);
  });
});
