import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  `redirect` throws in Next so that nothing after it runs. Reproduced here rather than stubbed to a
  no-op: a spec whose fake redirect returns normally would pass just as happily against a page that
  redirected and then rendered the login button anyway.
*/
class RedirectError extends Error {
  constructor(readonly to: string) {
    super(`NEXT_REDIRECT:${to}`);
  }
}

vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new RedirectError(to);
  }),
}));

vi.mock('@/shared/lib/patient-guard', () => ({
  patientGuard: { requirePatient: vi.fn() },
}));

vi.mock('@/features/patient/components/portal-login-confirm', () => ({
  PortalLoginConfirm: ({ token }: { token: string }) => `confirm:${token}`,
}));

import { patientGuard } from '@/shared/lib/patient-guard';

import PortalLoginPage from './page';

const guard = vi.mocked(patientGuard);

const TOKEN = 'a-link-from-an-email';

const render = () => PortalLoginPage({ params: Promise.resolve({ token: TOKEN }) });

describe('PortalLoginPage', () => {
  beforeEach(() => vi.resetAllMocks());

  /**
   * The lockout this exists to end. A clinic edits the plan, the patient taps the email, and the
   * link it carries is single-use — but their device is already signed in, so there is no reason
   * to ask them for a credential at all.
   */
  it('sends a patient who already has a session straight to their plan', async () => {
    guard.requirePatient.mockResolvedValue({
      patientId: 'p',
      clinicId: 'c',
      locale: 'ka',
    });

    await expect(render()).rejects.toThrow('NEXT_REDIRECT:/p');
  });

  /**
   * Checked before the token is looked at, so a spent, expired or revoked link behaves the same as
   * a good one for a device that is already through the door.
   */
  it('does not need the token to be good to let that patient in', async () => {
    guard.requirePatient.mockResolvedValue({
      patientId: 'p',
      clinicId: 'c',
      locale: 'ka',
    });

    await expect(render()).rejects.toThrow(RedirectError);
    // The link is left unspent — nothing here reads or redeems it.
  });

  it('shows the confirm button to a device with no session', async () => {
    guard.requirePatient.mockResolvedValue(null);

    await expect(render()).resolves.toBeDefined();
  });

  /** The button is what carries the token, so it has to arrive with the one from the URL. */
  it('hands the confirm button the token from the URL', async () => {
    guard.requirePatient.mockResolvedValue(null);

    const element = await render();

    expect(element.props.token).toBe(TOKEN);
  });
});
