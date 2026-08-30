import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString().slice(0, 10),
  }),
}));

vi.mock('@/features/care-plan/hooks/use-portal-plan', () => ({
  usePortalPlan: vi.fn(),
}));

vi.mock('@/features/patient/hooks/use-timezone-sync', () => ({
  useTimezoneSync: vi.fn(),
}));

/*
  The panels below the plan each read their own endpoint. None of them is what these tests are
  about, and letting them mount would put a network call behind an assertion about one sentence.
*/
vi.mock('@/features/recovery-log/components/recovery-log-form', () => ({
  RecoveryLogForm: () => null,
}));
vi.mock('@/features/recovery-guide/components/recovery-guide-panel', () => ({
  RecoveryGuidePanel: () => null,
}));
vi.mock('@/features/rating/components/portal-rating-card', () => ({
  PortalRatingCard: () => null,
}));
vi.mock('@/features/notifications/components/push-opt-in', () => ({
  PushOptIn: () => null,
}));

import { PortalPlan } from '@/features/care-plan/components/portal-plan';
import { usePortalPlan } from '@/features/care-plan/hooks/use-portal-plan';
import { PortalDay, PortalPlanView } from '@/features/care-plan/types/portal.types';

const planHook = vi.mocked(usePortalPlan);

const TODAY = '2026-08-30';

const occurrence = (id: string, scheduledAt: string) => ({
  id,
  kind: 'recovery_log' as const,
  title: 'Recovery check-in',
  body: '',
  intensity: null,
  dueAt: scheduledAt,
  scheduledAt,
  status: 'pending' as const,
});

const view = (over: Partial<PortalPlanView> = {}): PortalPlanView => ({
  todayIso: `${TODAY}T08:53:00.000Z`,
  todayKey: TODAY,
  timeZone: 'Asia/Tbilisi',
  days: [],
  nextCheckup: null,
  /** Non-null is the service having found an *active* plan — see `getPortalPlanService`. */
  rehabEndsAt: '2026-09-15T00:00:00.000Z',
  ...over,
});

const state = (plan: PortalPlanView | null) => ({
  plan,
  isLoading: false,
  hasError: false,
  reload: vi.fn().mockResolvedValue(undefined),
  complete: vi.fn().mockResolvedValue(undefined),
});

const day = (date: string): PortalDay => ({
  date,
  occurrences: [occurrence(`o-${date}`, `${date}T15:00:00.000Z`)],
});

/**
 * What the portal says on a day with nothing on it.
 *
 * It used to say one thing in every case: "your plan continues tomorrow". That is false for a
 * patient whose plan has finished — it is the state a completed plan sits in for good, so the
 * portal told someone with nothing left to do to come back tomorrow, every day, forever. It was
 * also wrong whenever the next task was several days out rather than one.
 *
 * Reported as recurring check-ins failing to render past day one. They were not: the generator
 * files a prompt for every day of the first week (`recoveryLogDays`), and the plan behind the
 * report had simply ended. What the patient was actually reading was this sentence.
 */
describe('PortalPlan — the empty day', () => {
  it('shows today’s tasks when there are any', () => {
    planHook.mockReturnValue(state(view({ days: [day(TODAY)] })));

    render(<PortalPlan patientPhone="" />);

    expect(screen.getByText('Recovery check-in')).toBeInTheDocument();
    expect(screen.queryByText(/nothingToday/)).not.toBeInTheDocument();
  });

  /*
    The case in the bug report. `rehabEndsAt` null is the service finding no active plan, which
    covers a finished one and a patient who has none yet — neither continues, so neither may say
    it does.
  */
  it('never claims a finished plan continues', () => {
    planHook.mockReturnValue(state(view({ rehabEndsAt: null })));

    render(<PortalPlan patientPhone="" />);

    expect(screen.getByText('nothingTodayNoPlan')).toBeInTheDocument();
    expect(screen.queryByText(/nothingTodayNext/)).not.toBeInTheDocument();
    expect(screen.queryByText('nothingTodayHelp')).not.toBeInTheDocument();
  });

  /* Naming the day, rather than promising tomorrow and being wrong by two days. */
  it('says which day the plan next has something on', () => {
    planHook.mockReturnValue(state(view({ days: [day('2026-09-02')] })));

    render(<PortalPlan patientPhone="" />);

    expect(screen.getByText('nothingTodayNext:2026-09-02')).toBeInTheDocument();
  });

  /*
    A running plan whose next task is past the window the portal reads. It continues, and there is
    no honest date to give — so it says the first without inventing the second.
  */
  it('says the plan continues without naming a day it cannot see', () => {
    planHook.mockReturnValue(state(view({ days: [] })));

    render(<PortalPlan patientPhone="" />);

    expect(screen.getByText('nothingTodayHelp')).toBeInTheDocument();
  });

  /* A past day still in the window is not "next". Only days after today may be offered. */
  it('ignores yesterday when working out what comes next', () => {
    planHook.mockReturnValue(state(view({ days: [day('2026-08-29')] })));

    render(<PortalPlan patientPhone="" />);

    expect(screen.getByText('nothingTodayHelp')).toBeInTheDocument();
  });
});
