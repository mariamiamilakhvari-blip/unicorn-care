import { EmailClinic } from '@/features/notifications/types/email.types';
import { EmailCopy } from '@/shared/const/email-copy.const';

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
const MOSS = '#5F661F';
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
    `background:${MOSS};color:#ffffff;font-size:11px;`,
  ].join('');
  return `<span style="${style}">${escapeHtml(text)}</span>`;
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
  const phoneStyle = `margin:6px 0 0 0;font-size:13px;color:${MUTED};`;
  const phone = clinic.phone
    ? `<p style="${phoneStyle}">${escapeHtml(copy.questionsCall)} ${escapeHtml(clinic.phone)}</p>`
    : '';
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
            ${phone}
            <p style="margin:10px 0 0 0;font-size:12px;color:${MUTED};">${escapeHtml(copy.footerNote)}</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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
export function toPlainText(headline: string, lines: string[], clinic: EmailClinic): string {
  const phone = clinic.phone ? `\n${clinic.phone}` : '';
  return [headline, '', ...lines, '', clinic.name + phone].join('\n');
}
