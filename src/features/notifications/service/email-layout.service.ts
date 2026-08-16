import { EmailClinic } from '@/features/notifications/types/email.types';
import { EmailCopy } from '@/shared/const/email-copy.const';
import { PATIENT_PORTAL_ROUTE } from '@/shared/const/routes.const';
import { SITE_URL } from '@/shared/const/seo.const';

/**
 * Shared shell and section helpers for patient emails.
 *
 * Styling is inline attributes rather than Tailwind: CLAUDE.md §0 governs the React UI, where
 * Tailwind compiles and a stylesheet is served. Neither is true in an inbox — Gmail strips
 * `<style>` blocks and no mail client resolves a utility class — so inline is the only thing that
 * survives. These are HTML strings, not components; nothing here uses a React `style` prop.
 */

/** Escapes clinic- and patient-authored text. Every value in an email passes through this. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND = '#092B4D';
const SAGE = '#79947E';
/* Sage is light enough that white on it is 3.31:1. Badge text is 11px, so it gets ink at 5.31:1. */
const SAGE_INK = '#071A2E';
const TEXT = '#1f2933';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';

export function section(emoji: string, title: string, body: string): string {
  if (!body) return '';
  return `
    <tr><td style="padding:20px 24px 0 24px;">
      <h2 style="margin:0 0 10px 0;font-size:16px;font-weight:600;color:${BRAND};">
        ${emoji} ${escapeHtml(title)}
      </h2>
      ${body}
    </td></tr>`;
}

export function list(items: string[]): string {
  if (items.length === 0) return '';
  const rows = items
    .map(
      item =>
        `<li style="margin:0 0 6px 0;font-size:14px;line-height:1.5;color:${TEXT};">${item}</li>`
    )
    .join('');
  return `<ul style="margin:0;padding-left:18px;">${rows}</ul>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0;font-size:14px;line-height:1.5;color:${TEXT};">${text}</p>`;
}

export function muted(text: string): string {
  const style = `margin:0;font-size:14px;line-height:1.5;color:${MUTED};`;
  return `<p style="${style}">${escapeHtml(text)}</p>`;
}

export function badge(text: string): string {
  const style = [
    'display:inline-block;padding:1px 7px;margin-left:6px;border-radius:10px;',
    `background:${SAGE};color:${SAGE_INK};font-size:11px;`,
  ].join('');
  return `<span style="${style}">${escapeHtml(text)}</span>`;
}

/**
 * The clinic's contact block, built from whatever the clinic has actually filled in.
 *
 * Each line is dropped entirely when its value is empty — label included. The profile form
 * requires none of these fields, so a half-filled clinic is the normal case rather than the
 * broken one, and an email that prints "Address:" followed by nothing reads as a fault in the
 * platform rather than a gap in the clinic's own record.
 *
 * The phone and email are live links: a patient reading this on the phone that is already in
 * their hand should be one tap from the clinic, not copying digits across apps.
 */
function contactLines(clinic: EmailClinic, copy: EmailCopy): string {
  const style = `margin:6px 0 0 0;font-size:13px;color:${MUTED};`;
  const linkStyle = `color:${MUTED};`;

  const lines = [
    clinic.addressLine && `${escapeHtml(copy.addressLabel)} ${escapeHtml(clinic.addressLine)}`,
    clinic.phone &&
      `${escapeHtml(copy.phoneLabel)} <a href="tel:${escapeHtml(clinic.phone.replace(/\s+/g, ''))}" style="${linkStyle}">${escapeHtml(clinic.phone)}</a>`,
    clinic.email &&
      `${escapeHtml(copy.emailLabel)} <a href="mailto:${escapeHtml(clinic.email)}" style="${linkStyle}">${escapeHtml(clinic.email)}</a>`,
  ].filter(Boolean);

  return lines.map(line => `<p style="${style}">${line}</p>`).join('');
}

/**
 * Wraps the sections in a table-based shell. Tables rather than flex or grid because Outlook still
 * renders mail with Word's engine, which supports neither.
 */
export function shell(
  headline: string,
  sections: string,
  clinic: EmailClinic,
  copy: EmailCopy
): string {
  const contact = contactLines(clinic, copy);
  const cardStyle = [
    'max-width:560px;background:#ffffff;border-radius:12px;',
    `border:1px solid ${BORDER};`,
  ].join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${cardStyle}">
        <tr><td style="padding:24px 24px 0 24px;">
          <h1 style="margin:0;font-size:20px;font-weight:600;color:${BRAND};">${escapeHtml(headline)}</h1>
        </td></tr>
        ${sections}
        <tr><td style="padding:24px;">
          <div style="border-top:1px solid ${BORDER};padding-top:16px;">
            <p style="margin:0;font-size:14px;font-weight:600;color:${TEXT};">${escapeHtml(clinic.name)}</p>
            ${contact}
            <p style="margin:10px 0 0 0;font-size:12px;color:${MUTED};">${escapeHtml(copy.footerNote)}</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * The primary action button.
 *
 * A table rather than a styled `<a>`: Outlook ignores padding on inline elements, so a bare
 * anchor renders as a bordered sliver of text. Bulletproof-button markup is ugly and is the only
 * thing that produces a tappable target in every client.
 */
export function button(label: string, href: string): string {
  const cell = [
    `background:${BRAND};border-radius:8px;`,
    'font-size:15px;font-weight:600;line-height:1;',
  ].join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 0 0;">
      <tr><td style="${cell}">
        <a href="${escapeHtml(href)}"
          style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;">
          ${escapeHtml(label)}
        </a>
      </td></tr>
    </table>`;
}

/** Formats a date in the clinic's zone. Numeric so it reads the same in both languages. */
export function zonedDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function zonedTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** The plain-text alternative every client falls back to, derived from the same section text. */
export function toPlainText(
  headline: string,
  lines: string[],
  clinic: EmailClinic,
  copy: EmailCopy
): string {
  // Same omission rule as the HTML footer: a label with nothing after it is worse than no label.
  const contact = [
    clinic.addressLine && `${copy.addressLabel} ${clinic.addressLine}`,
    clinic.phone && `${copy.phoneLabel} ${clinic.phone}`,
    clinic.email && `${copy.emailLabel} ${clinic.email}`,
  ].filter(Boolean) as string[];

  return [headline, '', ...lines, '', clinic.name, ...contact].join('\n');
}

/**
 * The tokenless portal address, and the fallback when a per-email link could not be minted.
 *
 * On its own it only opens for a browser that already holds the portal cookie — which is exactly
 * the assumption that failed: a patient reading the email in their mail app's in-app browser, or
 * on a new phone, or after clearing cookies, has no cookie and lands on the expired-link page.
 * Every patient email therefore carries its own single-use link (`portalLinkForEmail`), and this
 * remains only as the honest degradation when minting one fails — the page it reaches is where a
 * patient can ask for a link, so even the fallback is not a dead end.
 */
export const PORTAL_URL = `${SITE_URL}${PATIENT_PORTAL_ROUTE}`;

/**
 * The "open your portal" call to action, as one section.
 *
 * Every patient-facing template ends with this. Sharing it is what stops the templates drifting:
 * a new email gets the CTA by calling one function, rather than by whoever wrote it remembering
 * that emails are supposed to have one.
 *
 * `url` is the patient's own single-use link. It is defaulted rather than required so a template
 * built without one still sends — a missing link is a worse email, not a failed send.
 */
export function portalCta(copy: EmailCopy, url: string = PORTAL_URL): string {
  return section('', copy.openPortal, button(copy.openPortal, url));
}

/** The same call to action for the plain-text alternative, which must not be left behind. */
export function portalCtaLines(copy: EmailCopy, url: string = PORTAL_URL): string[] {
  return ['', copy.openPortal, url];
}
