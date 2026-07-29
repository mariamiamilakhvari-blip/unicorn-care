import { describe, expect, it } from 'vitest';

import { DailyEmailInput } from '@/features/notifications/types/email.types';

import { applicableOnDay, buildDailyEmail } from './daily-email.service';


function input(overrides: Partial<DailyEmailInput> = {}): DailyEmailInput {
  return {
    patient: { firstName: 'Lika', lastName: 'Gabrichidze', email: 'p@example.com', locale: 'en' },
    clinic: { name: 'Unicorn Clinic', phone: '+995 555 10 20 30', timezone: 'Asia/Tbilisi' },
    medications: [
      {
        name: 'ibuprofeni',
        dosage: '1000 mg',
        timesOfDay: ['10:00', '22:00'],
        startsOn: new Date('2026-07-28T00:00:00.000Z'),
        endsOn: new Date('2026-07-30T00:00:00.000Z'),
        withFood: true,
      },
    ],
    rehabTasks: [],
    nextCheckup: {
      title: 'Visit to doctor',
      scheduledAt: new Date('2026-08-30T06:00:00.000Z'),
      location: 'to the clinic',
    },
    daysUntilCheckup: 32,
    guide: {
      expected: [
        { title: 'swelling', description: '', fromDay: 0, toDay: 7 },
        { title: 'scar fading', description: '', fromDay: 30, toDay: 90 },
      ],
      warning: [{ title: 'redness', description: '', severity: 'call_clinic', fromDay: 0, toDay: 14 }],
    },
    recoveryDay: 3,
    ...overrides,
  };
}

describe('buildDailyEmail', () => {
  it("shows today's medications with their times", () => {
    const { html } = buildDailyEmail(input());

    // The apostrophe is escaped, which is the point of escapeHtml — assert what actually ships.
    expect(html).toContain('Today&#39;s medications');
    expect(html).toContain('ibuprofeni');
    expect(html).toContain('10:00, 22:00');
  });

  it('counts down the days until the checkup', () => {
    const { html } = buildDailyEmail(input());

    expect(html).toContain('Days until your checkup');
    expect(html).toContain('32 days');
  });

  it('says "today" rather than "0 days" on the day of the checkup', () => {
    const { html } = buildDailyEmail(input({ daysUntilCheckup: 0 }));

    expect(html).toContain('today');
    expect(html).not.toContain('0 days');
  });

  /** The point of the daily email: only what applies to this specific recovery day. */
  it('includes only guide entries whose day window covers today', () => {
    const { html } = buildDailyEmail(input({ recoveryDay: 3 }));

    expect(html).toContain('swelling');
    expect(html).not.toContain('scar fading');
  });

  it('drops a guide entry once its window has passed', () => {
    const { html } = buildDailyEmail(input({ recoveryDay: 40 }));

    expect(html).not.toContain('swelling');
    expect(html).toContain('scar fading');
    expect(html).not.toContain('redness');
  });

  it('says so plainly when nothing is due today', () => {
    const { html } = buildDailyEmail(input({ medications: [], rehabTasks: [] }));

    expect(html).toContain('Nothing scheduled for today.');
  });

  it('writes Georgian for a Georgian patient', () => {
    const { html, subject } = buildDailyEmail(
      input({
        patient: { firstName: 'ლიკა', lastName: 'გ', email: 'p@example.com', locale: 'ka' },
      })
    );

    expect(subject).toContain('თქვენი აღდგენა დღეს');
    expect(html).toContain('დღევანდელი მედიკამენტები');
  });
});

describe('applicableOnDay', () => {
  it('includes both boundary days of a window', () => {
    const entries = [{ fromDay: 2, toDay: 5 }];

    expect(applicableOnDay(entries, 2)).toHaveLength(1);
    expect(applicableOnDay(entries, 5)).toHaveLength(1);
    expect(applicableOnDay(entries, 1)).toHaveLength(0);
    expect(applicableOnDay(entries, 6)).toHaveLength(0);
  });
});
