import { describe, expect, it } from 'vitest';

import { buildReminderEmail } from '@/features/notifications/service/reminder-email.service';
import { ReminderEmailInput } from '@/features/notifications/types/email.types';

function input(overrides: Partial<ReminderEmailInput> = {}): ReminderEmailInput {
  return {
    patient: { firstName: 'Lika', lastName: 'Gabrichidze', email: 'p@example.com', locale: 'en' },
    clinic: {
      name: 'Gagua Clinic',
      addressLine: 'Vazha-Pshavela Ave 27b',
      phone: '+995 32 2 122 122',
      email: 'info@gagua.ge',
      timezone: 'Asia/Tbilisi',
    },
    title: 'citramoni — 500',
    body: 'with food',
    // 13:25 UTC is 17:25 in Tbilisi: a 17:30 dose with a 5-minute lead.
    dueAt: new Date('2026-08-08T13:25:00.000Z'),
    portalUrl: 'https://unicorncare.space/p',
    ...overrides,
  };
}

describe('buildReminderEmail', () => {
  it('names the medication and dose, so the email is actionable without opening anything', () => {
    const email = buildReminderEmail(input());

    expect(email.subject).toContain('citramoni — 500');
    expect(email.html).toContain('citramoni');
    expect(email.html).toContain('with food');
  });

  it('shows the time in the clinic zone, not UTC', () => {
    const email = buildReminderEmail(input());

    // 13:25Z in Asia/Tbilisi (UTC+4).
    expect(email.html).toContain('17:25');
    expect(email.html).not.toContain('13:25');
  });

  it('carries a portal link and never a portal token', () => {
    const email = buildReminderEmail(input());

    expect(email.html).toContain('https://unicorncare.space/p');
    // A magic-link path would be /p/<token>. An email must not carry a credential.
    expect(email.html).not.toMatch(/\/p\/[A-Za-z0-9_-]{10,}/);
  });

  it('writes to an English patient in English', () => {
    const email = buildReminderEmail(input());

    expect(email.subject).toContain('Reminder');
    expect(email.html).toContain('Open your portal');
  });

  it('writes to a Georgian patient in Georgian', () => {
    const email = buildReminderEmail(
      input({
        patient: { firstName: 'ლიკა', lastName: 'გაბრიჩიძე', email: 'p@example.com', locale: 'ka' },
      })
    );

    expect(email.subject).toContain('შეხსენება');
    expect(email.html).toContain('გახსენით თქვენი პორტალი');
    expect(email.html).not.toContain('Open your portal');
  });

  it('escapes clinic-authored text rather than trusting it in HTML', () => {
    const email = buildReminderEmail(input({ title: '<script>alert(1)</script>' }));

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('renders without a body, which a checkup reminder has none of', () => {
    const email = buildReminderEmail(input({ body: '' }));

    expect(email.html).toContain('citramoni');
    expect(email.text).not.toContain('undefined');
  });

  describe('the clinic contact footer', () => {
    it('carries every detail the clinic has filled in', () => {
      const email = buildReminderEmail(input());

      expect(email.html).toContain('Gagua Clinic');
      expect(email.html).toContain('Vazha-Pshavela Ave 27b');
      expect(email.html).toContain('+995 32 2 122 122');
      expect(email.html).toContain('info@gagua.ge');
    });

    it('makes the phone and email tappable', () => {
      const email = buildReminderEmail(input());

      // Spaces stripped from the dial string: a tel: link with spaces fails on some handsets.
      expect(email.html).toContain('href="tel:+995322122122"');
      expect(email.html).toContain('href="mailto:info@gagua.ge"');
    });

    it.each([
      ['address', 'addressLine', 'Address:'],
      ['phone', 'phone', 'Phone:'],
      ['email', 'email', 'Email:'],
    ])('omits the %s line whole when the clinic has not set one', (_label, field, label) => {
      const email = buildReminderEmail(
        input({ clinic: { ...input().clinic, [field]: '' } })
      );

      // The label goes with the value. A stranded "Phone:" reads as a fault in the platform.
      expect(email.html).not.toContain(label);
      expect(email.html).toContain('Gagua Clinic');
    });

    it('still renders with no contact details at all', () => {
      const email = buildReminderEmail(
        input({
          clinic: {
            name: 'Gagua Clinic',
            addressLine: '',
            phone: '',
            email: '',
            timezone: 'Asia/Tbilisi',
          },
        })
      );

      expect(email.html).toContain('Gagua Clinic');
      expect(email.html).toContain('citramoni');
      expect(email.text).toContain('Gagua Clinic');
    });
  });
});
