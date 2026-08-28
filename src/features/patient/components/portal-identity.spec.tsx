import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/features/patient/hooks/use-portal-sign-out', () => ({
  usePortalSignOut: vi.fn(),
}));

import { PortalIdentity } from '@/features/patient/components/portal-identity';
import { usePortalSignOut } from '@/features/patient/hooks/use-portal-sign-out';

const signOutHook = vi.mocked(usePortalSignOut);

const state = (over: Partial<ReturnType<typeof usePortalSignOut>> = {}) => ({
  isSigningOut: false,
  signOut: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const notYou = () => screen.getByRole('button', { name: 'notYou' });

/**
 * The strip that answers "whose plan is this".
 *
 * The question is not hypothetical. A portal session lives in a cookie that outlasts the tab, and
 * a link issued for another patient changes nothing until it is redeemed — so a device that once
 * opened one plan keeps opening it, and before this existed the screen looked the same either way.
 * A clinic tablet handed between patients, or a phone shared by a family, lands here by default.
 */
describe('PortalIdentity', () => {
  it('names the patient whose plan is on screen', () => {
    signOutHook.mockReturnValue(state());

    render(<PortalIdentity patientName="Nini Nutsibidze" />);

    expect(screen.getByText('Nini Nutsibidze')).toBeInTheDocument();
    expect(screen.getByText('viewingAs')).toBeInTheDocument();
  });

  it('offers the way out beside the name', () => {
    signOutHook.mockReturnValue(state());

    render(<PortalIdentity patientName="Nini Nutsibidze" />);

    expect(notYou()).toBeInTheDocument();
  });

  it('clears the session when the patient says it is not them', () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    signOutHook.mockReturnValue(state({ signOut }));

    render(<PortalIdentity patientName="Nini Nutsibidze" />);
    fireEvent.click(notYou());

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('does not let the sign-out be fired twice while it runs', () => {
    const signOut = vi.fn();
    signOutHook.mockReturnValue(state({ isSigningOut: true, signOut }));

    render(<PortalIdentity patientName="Nini Nutsibidze" />);

    expect(notYou()).toBeDisabled();
    fireEvent.click(notYou());
    expect(signOut).not.toHaveBeenCalled();
  });

  /*
    An erased record has no name to print, and `[ERASED]` is filtered out upstream in the guard.
    The strip says the record is closed rather than rendering an empty space where the one fact a
    reader is checking should be — a blank there reads as a broken page, not as an answer.
  */
  it('says the record is closed when there is no name', () => {
    signOutHook.mockReturnValue(state());

    render(<PortalIdentity patientName="" />);

    expect(screen.getByText('viewingAsErased')).toBeInTheDocument();
    // Still reachable: an erased patient must be able to get off this session.
    expect(notYou()).toBeEnabled();
  });
});
