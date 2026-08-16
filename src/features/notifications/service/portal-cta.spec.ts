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

/** What `portalLinkForEmail` hands the builders: this email's own single-use link. */
const PORTAL_LINK = 'https://unicorn.care/p/login/Xy7-a9Bc_D3eF6gH8iJkLmNoPqRsTuVwXyZ0123456789';

const plan = {
  patient,
  clinic,
  portalUrl: PORTAL_LINK,
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
      scheduledAt: new Date('2026-08-09T04:00:00.000Z'),
      portalUrl: PORTAL_LINK,
    }),
  };

  it.each(Object.entries(built))('%s carries the portal link in the HTML', (_name, email) => {
    expect(email.html).toContain(PORTAL_LINK);
  });

  it.each(Object.entries(built))('%s carries it in the plain text too', (_name, email) => {
    // A text alternative without the link is what a plain-text client would show.
    expect(email.text).toContain(PORTAL_LINK);
  });

  it.each(Object.entries(built))('%s labels the link in the patient’s language', (_name, email) => {
    expect(email.html).toContain(emailCopy('ka').openPortal);
  });

  /**
   * The link is the patient's own, not the bare portal address.
   *
   * A tokenless CTA only opened for a browser that already held the portal cookie — which the
   * patient reading their reminder in a mail app's in-app browser, on a new phone, or after
   * clearing cookies does not. That was the lockout: the email arrived, and the link in it went
   * to "invalid or inactive link".
   */
  it.each(Object.entries(built))('%s links the patient’s own way in', (_name, email) => {
    expect(email.html).toContain('/p/login/');
  });

  /**
   * The fallback still sends. Minting a link is a database write, and an email that lands with the
   * bare portal address is worth more than an email that never leaves — that address reaches the
   * page where a patient can ask for a link, so it is not a dead end either.
   */
  it('falls back to the tokenless portal address when no link was minted', () => {
    const email = buildReminderEmail({
      patient,
      clinic,
      title: 'Amoxicillin — 500 mg',
      body: 'Take with food. 08:00',
      dueAt: new Date('2026-08-09T04:00:00.000Z'),
      scheduledAt: new Date('2026-08-09T04:00:00.000Z'),
    });

    expect(email.html).toContain(PORTAL_URL);
    expect(email.text).toContain(PORTAL_URL);
  });
});
