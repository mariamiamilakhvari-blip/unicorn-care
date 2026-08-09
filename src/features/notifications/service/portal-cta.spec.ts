import { describe, expect, it } from 'vitest';

import { buildDailyEmail } from '@/features/notifications/service/daily-email.service';
import { PORTAL_URL } from '@/features/notifications/service/email-layout.service';
import { buildReminderEmail } from '@/features/notifications/service/reminder-email.service';
import { buildWelcomeEmail } from '@/features/notifications/service/welcome-email.service';
import { emailCopy } from '@/shared/const/email-copy.const';

const clinic = {
  name: 'Gold Esthetic',
  timezone: 'Asia/Tbilisi',
  addressLine: '12 Rustaveli Ave, Tbilisi',
  phone: '+995 555 00 00 00',
  email: 'care@example.com',
  locale: 'ka' as const,
};

const patient = {
  firstName: 'Nino',
  lastName: 'Beridze',
  email: 'nino@example.com',
  locale: 'ka' as const,
};

const plan = {
  patient,
  clinic,
  procedure: null,
  medications: [],
  rehabTasks: [],
  checkups: [],
  nextCheckup: null,
  daysUntilCheckup: null,
  guide: null,
  recoveryDay: 3,
  startsAt: new Date('2026-08-01T06:00:00.000Z'),
  rehabEndsAt: new Date('2026-10-01T06:00:00.000Z'),
};

/**
 * The daily summary shipped without a portal link for as long as it existed — the email a patient
 * receives most often was the only one with no way to act on it. Three templates were each
 * building the same URL by hand, so a fourth simply forgot.
 *
 * These cases are deliberately written per template rather than over a shared list: a new email
 * that forgets the call to action should fail here by omission being visible, and the cheapest
 * way to notice is a named test that does not exist yet.
 */
describe('every patient-facing email offers the portal', () => {
  const built = {
    welcome: buildWelcomeEmail(plan),
    daily: buildDailyEmail(plan),
    reminder: buildReminderEmail({
      patient,
      clinic,
      title: 'Amoxicillin — 500 mg',
      body: 'Take with food. 08:00',
      dueAt: new Date('2026-08-09T04:00:00.000Z'),
    }),
  };

  it.each(Object.entries(built))('%s carries the portal link in the HTML', (_name, email) => {
    expect(email.html).toContain(PORTAL_URL);
  });

  it.each(Object.entries(built))('%s carries it in the plain text too', (_name, email) => {
    // A text alternative without the link is what a plain-text client would show.
    expect(email.text).toContain(PORTAL_URL);
  });

  it.each(Object.entries(built))('%s labels the link in the patient’s language', (_name, email) => {
    expect(email.html).toContain(emailCopy('ka').openPortal);
  });

  /**
   * No token in the link, matching the decision every other patient email follows: a portal
   * credential in an inbox outlives the message, and an old email in a compromised account would
   * be a live door into that patient's record.
   */
  it.each(Object.entries(built))('%s carries no credential in the link', (_name, email) => {
    expect(email.html).not.toMatch(/\/p\/[A-Za-z0-9_-]{16,}/);
    expect(PORTAL_URL).not.toMatch(/token|[?&]t=/i);
  });
});
