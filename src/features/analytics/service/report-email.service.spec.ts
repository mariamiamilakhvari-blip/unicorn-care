import { describe, expect, it } from 'vitest';

import { buildReportEmail } from '@/features/analytics/service/report-email.service';
import { ClinicAnalytics } from '@/features/analytics/types/analytics.types';
import { EmailClinic, EmailPatient } from '@/features/notifications/types/email.types';

const clinic: EmailClinic = {
  name: 'Gagua Clinic',
  addressLine: 'Vazha-Pshavela Ave 27b',
  phone: '+995 32 2 122 122',
  email: 'info@gagua.ge',
  timezone: 'Asia/Tbilisi',
};

const recipient = (locale: 'ka' | 'en'): EmailPatient => ({
  firstName: 'Gagua',
  lastName: '',
  email: 'info@gagua.ge',
  locale,
});

function analytics(overrides: Partial<ClinicAnalytics> = {}): ClinicAnalytics {
  return {
    clinicId: '507f1f77bcf86cd799439011',
    clinicName: 'Gagua Clinic',
    range: {
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.999Z',
      label: 'Q3 2026',
    },
    activePatients: 42,
    newPatients: 8,
    reminders: { total: 500, dispatched: 480, done: 300, skipped: 50, missed: 50, pending: 100 },
    delivery: {
      push: { delivered: 380, attempted: 480, rate: 380 / 480 },
      email: { delivered: 450, attempted: 480, rate: 450 / 480 },
    },
    excludedUndelivered: 0,
    adherenceRate: 0.75,
    locales: [
      { locale: 'ka', count: 34, share: 34 / 42 },
      { locale: 'en', count: 8, share: 8 / 42 },
    ],
    hoursSaved: {
      hours: 29.7,
      fromReminders: 1660,
      fromOnboarding: 120,
      minutesPerReminder: 2,
      minutesPerPatient: 15,
    },
    ...overrides,
  };
}

describe('buildReportEmail', () => {
  it('leads with the quarter it covers', () => {
    const email = buildReportEmail(analytics(), clinic, recipient('en'));

    expect(email.subject).toContain('Q3 2026');
    expect(email.html).toContain('Q3 2026');
  });

  it('carries the headline figures', () => {
    const email = buildReportEmail(analytics(), clinic, recipient('en'));

    expect(email.html).toContain('42');
    expect(email.html).toContain('830'); // delivered push + email
    expect(email.html).toContain('75%');
    expect(email.html).toContain('29.7');
  });

  it('states the assumption behind the hours estimate, next to the number', () => {
    // A figure a clinic cannot check is a figure it should not be asked to believe.
    const email = buildReportEmail(analytics(), clinic, recipient('en'));

    expect(email.html).toContain('estimate, not a measurement');
    expect(email.html).toContain('2 minutes per delivered reminder');
  });

  it('says "not recorded" rather than 0% for a channel with no attempts', () => {
    const email = buildReportEmail(
      analytics({
        delivery: {
          push: { delivered: 0, attempted: 0, rate: null },
          email: { delivered: 0, attempted: 0, rate: null },
        },
      }),
      clinic,
      recipient('en')
    );

    // Once per channel. Asserting the absence of "0%" would only catch the bar's CSS width, which
    // is legitimately zero — what must not appear is a *reported rate* of zero.
    expect(email.html.match(/Not recorded/g)).toHaveLength(2);
    expect(email.html).not.toMatch(/>\s*0%\s*</);
  });

  it('writes in the clinic language, not the admin one', () => {
    const email = buildReportEmail(analytics(), clinic, recipient('ka'));

    expect(email.subject).toContain('კვარტალური');
    expect(email.html).toContain('კვარტალური შედეგების შეჯამება');
    expect(email.html).not.toContain('Quarterly impact summary');
  });

  it('carries the clinic contact footer', () => {
    const email = buildReportEmail(analytics(), clinic, recipient('en'));

    expect(email.html).toContain('Vazha-Pshavela Ave 27b');
    expect(email.html).toContain('href="tel:+995322122122"');
  });

  it('escapes a clinic name rather than trusting it in HTML', () => {
    const email = buildReportEmail(
      analytics({ clinicName: '<script>alert(1)</script>' }),
      { ...clinic, name: '<script>alert(1)</script>' },
      recipient('en')
    );

    expect(email.html).not.toContain('<script>');
  });

  it('renders a quarter in which nothing happened', () => {
    const email = buildReportEmail(
      analytics({
        activePatients: 0,
        newPatients: 0,
        reminders: { total: 0, dispatched: 0, done: 0, skipped: 0, missed: 0, pending: 0 },
        delivery: {
          push: { delivered: 0, attempted: 0, rate: null },
          email: { delivered: 0, attempted: 0, rate: null },
        },
        adherenceRate: null,
        locales: [
          { locale: 'ka', count: 0, share: 0 },
          { locale: 'en', count: 0, share: 0 },
        ],
        hoursSaved: {
          hours: 0,
          fromReminders: 0,
          fromOnboarding: 0,
          minutesPerReminder: 2,
          minutesPerPatient: 15,
        },
      }),
      clinic,
      recipient('en')
    );

    expect(email.html).toContain('Gagua Clinic');
    expect(email.text).not.toContain('undefined');
    expect(email.text).not.toContain('NaN');
  });
});
