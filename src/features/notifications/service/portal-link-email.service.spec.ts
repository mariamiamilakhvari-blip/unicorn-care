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

  /*
    A date beats a duration whenever there is a real one to name. It is what a post-operative
    patient can hold against their own recovery, and the link is now cut to that recovery rather
    than to a fixed month, so a duration would also be the less accurate of the two.
  */
  describe('a link tied to the recovery period', () => {
    const ACTIVE_UNTIL = new Date('2026-09-11T00:00:00.000Z');

    it('names the end of the recovery rather than a duration', async () => {
      await sendPortalLinkEmailService(input({ activeUntil: ACTIVE_UNTIL }));

      expect(bothParts()).toContain('recovery period');
      expect(bothParts()).toContain('11/09/2026');
    });

    it('says it in Georgian for a Georgian patient', async () => {
      await sendPortalLinkEmailService(input({ locale: 'ka', activeUntil: ACTIVE_UNTIL }));

      expect(bothParts()).toContain('სარეაბილიტაციო პერიოდის დასრულებამდე');
      expect(bothParts()).toContain('11/09/2026');
    });

    /** The date the patient reads is the day it is where their clinic is, not in UTC. */
    it('prints the date in the clinic zone', async () => {
      await sendPortalLinkEmailService(
        input({
          activeUntil: new Date('2026-09-10T21:00:00.000Z'),
          clinic: { ...input().clinic, timezone: 'Asia/Tbilisi' },
        })
      );

      // 21:00 UTC is already the 11th in Tbilisi.
      expect(bothParts()).toContain('11/09/2026');
    });

    it('states a duration when there is no end date to name', async () => {
      await sendPortalLinkEmailService(input({ activeUntil: null, ttlHours: 30 * 24 }));

      expect(bothParts()).toContain('30 days');
      expect(bothParts()).not.toContain('recovery period');
    });
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
