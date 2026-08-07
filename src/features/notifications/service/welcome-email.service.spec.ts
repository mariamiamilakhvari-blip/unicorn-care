import { describe, expect, it } from 'vitest';

import { WelcomeEmailInput } from '@/features/notifications/types/email.types';

import { buildWelcomeEmail } from './welcome-email.service';


function input(overrides: Partial<WelcomeEmailInput> = {}): WelcomeEmailInput {
  return {
    patient: { firstName: 'Lika', lastName: 'Gabrichidze', email: 'p@example.com', locale: 'en' },
    clinic: {
      name: 'Unicorn Clinic',
      addressLine: '12 Rustaveli Ave',
      phone: '+995 555 10 20 30',
      email: 'info@unicorn.clinic',
      timezone: 'Asia/Tbilisi',
    },
    procedure: {
      manipulationType: 'rhinoplasty',
      performedAt: new Date('2026-07-27T09:00:00.000Z'),
      operatorName: 'Dr. Nino Kechakhmadze',
    },
    medications: [
      {
        name: 'ibuprofeni',
        dosage: '1000 mg',
        timesOfDay: ['10:00'],
        startsOn: new Date('2026-07-28T00:00:00.000Z'),
        endsOn: new Date('2026-07-30T00:00:00.000Z'),
        withFood: true,
      },
    ],
    rehabTasks: [
      {
        title: 'walking',
        intensity: 'light',
        durationMinutes: 15,
        timesOfDay: ['18:00'],
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startsOn: new Date('2026-07-28T00:00:00.000Z'),
        endsOn: new Date('2026-07-31T00:00:00.000Z'),
      },
    ],
    checkups: [
      {
        title: 'Visit to doctor',
        scheduledAt: new Date('2026-08-30T06:00:00.000Z'),
        location: 'to the clinic',
      },
    ],
    guide: {
      expected: [{ title: 'swelling', description: 'drink a lot of water', fromDay: 0, toDay: 7 }],
      warning: [{ title: 'redness', description: '', severity: 'call_clinic', fromDay: 0, toDay: 14 }],
    },
    ...overrides,
  };
}

describe('buildWelcomeEmail', () => {
  it('carries all nine sections the clinic asked for', () => {
    const { html } = buildWelcomeEmail(input());

    expect(html).toContain('Lika Gabrichidze');
    expect(html).toContain('rhinoplasty');
    expect(html).toContain('27/07/2026');
    expect(html).toContain('Dr. Nino Kechakhmadze');
    expect(html).toContain('ibuprofeni');
    expect(html).toContain('1000 mg');
    expect(html).toContain('10:00');
    expect(html).toContain('walking');
    expect(html).toContain('Light');
    expect(html).toContain('swelling');
    expect(html).toContain('redness');
    expect(html).toContain('Call your clinic');
    expect(html).toContain('30/08/2026');
    expect(html).toContain('Unicorn Clinic');
    expect(html).toContain('+995 555 10 20 30');
  });

  it('renders every section header with its emoji', () => {
    const { html } = buildWelcomeEmail(input());

    for (const emoji of ['👋', '🏥', '💊', '🧘', '✅', '⚠️', '📅']) {
      expect(html).toContain(emoji);
    }
  });

  it('writes Georgian when that is the patient locale', () => {
    const { html, subject } = buildWelcomeEmail(
      input({
        patient: { firstName: 'ლიკა', lastName: 'გაბრიჩიძე', email: 'p@example.com', locale: 'ka' },
      })
    );

    expect(subject).toContain('თქვენი სარეაბილიტაციო გეგმა');
    expect(html).toContain('მედიკამენტების განრიგი');
    expect(html).toContain('დაურეკეთ კლინიკას');
  });

  /**
   * Clinic-authored free text lands in an HTML document. Without escaping, a guide entry could
   * inject markup into a patient's inbox.
   */
  it('escapes clinic-authored text rather than emitting it as markup', () => {
    const { html } = buildWelcomeEmail(
      input({
        guide: {
          expected: [
            { title: '<script>alert(1)</script>', description: '', fromDay: 0, toDay: 3 },
          ],
          warning: [],
        },
      })
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('omits sections with nothing in them instead of printing empty headers', () => {
    const { html } = buildWelcomeEmail(
      input({ medications: [], rehabTasks: [], guide: null, checkups: [] })
    );

    expect(html).not.toContain('💊');
    expect(html).not.toContain('🧘');
    expect(html).not.toContain('⚠️');
    expect(html).not.toContain('📅');
  });

  it('ships a plain-text alternative alongside the HTML', () => {
    const { text } = buildWelcomeEmail(input());

    expect(text).toContain('ibuprofeni');
    expect(text).toContain('Unicorn Clinic');
    expect(text).not.toContain('<');
  });
});
