import { ClinicAnalytics, Rate } from '@/features/analytics/types/analytics.types';
import {
  escapeHtml,
  paragraph,
  section,
  shell,
  toPlainText,
  zonedDate,
} from '@/features/notifications/service/email-layout.service';
import { BuiltEmail, EmailClinic, EmailPatient } from '@/features/notifications/types/email.types';
import { emailCopy, EmailCopy } from '@/shared/const/email-copy.const';

const BRAND = '#092B4D';
const SAGE = '#79947E';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';

/** A percentage, or the "not recorded" wording when there was nothing to compute one from. */
function percent(value: number | null, copy: EmailCopy): string {
  return value === null ? copy.reportNoData : `${Math.round(value * 100)}%`;
}

/**
 * One headline figure.
 *
 * A table cell rather than a flex item, because Outlook renders mail through Word's engine and
 * supports neither flex nor grid — the numbers would stack into a column nobody scrolls through.
 */
function kpi(label: string, value: string): string {
  return `
    <td style="padding:12px 8px;text-align:center;border:1px solid ${BORDER};border-radius:8px;">
      <p style="margin:0;font-size:24px;font-weight:700;color:${BRAND};">${escapeHtml(value)}</p>
      <p style="margin:4px 0 0 0;font-size:12px;color:${MUTED};">${escapeHtml(label)}</p>
    </td>`;
}

/**
 * A proportion drawn as a filled bar.
 *
 * Two nested tables with a background colour, which is the only bar chart every mail client
 * renders — an inline SVG is stripped by Gmail and a remote chart image is blocked by default,
 * so both would leave the reader with nothing where the comparison should be.
 */
function bar(label: string, value: string, share: number): string {
  const width = Math.max(0, Math.min(100, Math.round(share * 100)));

  return `
    <tr><td style="padding:6px 0;">
      <p style="margin:0 0 4px 0;font-size:13px;color:${MUTED};">
        ${escapeHtml(label)} — <strong style="color:${BRAND};">${escapeHtml(value)}</strong>
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background:${BORDER};border-radius:4px;">
        <tr><td style="width:${width}%;background:${SAGE};height:8px;border-radius:4px;">&nbsp;</td>
        <td>&nbsp;</td></tr>
      </table>
    </td></tr>`;
}

function deliveryBar(label: string, rate: Rate, copy: EmailCopy): string {
  if (rate.attempted === 0) {
    return bar(label, copy.reportNoData, 0);
  }
  return bar(label, `${percent(rate.rate, copy)} (${rate.delivered}/${rate.attempted})`, rate.rate ?? 0);
}

/**
 * The sentence a clinic actually reads.
 *
 * Written from the numbers rather than chosen from a list of compliments: an insight that says
 * something good regardless of the data is an advertisement, and a clinic that spots that stops
 * believing the figures above it too.
 */
function insight(analytics: ClinicAnalytics, copy: EmailCopy): string {
  const lines: string[] = [];

  if (analytics.hoursSaved.hours > 0) {
    lines.push(
      `${copy.reportHoursSaved}: ~${analytics.hoursSaved.hours}h — ` +
        copy.reportHoursAssumption
          .replace('{minutesPerReminder}', String(analytics.hoursSaved.minutesPerReminder))
          .replace('{minutesPerPatient}', String(analytics.hoursSaved.minutesPerPatient))
    );
  }

  if (analytics.adherenceRate !== null) {
    lines.push(
      `${copy.reportAdherence}: ${percent(analytics.adherenceRate, copy)} ` +
        `(${analytics.reminders.done}/${analytics.reminders.done + analytics.reminders.skipped + analytics.reminders.missed})`
    );
  }

  if (analytics.reminders.missed > 0) {
    lines.push(copy.reportMissed.replace('{count}', String(analytics.reminders.missed)));
  }

  return lines.map(line => paragraph(escapeHtml(line))).join('');
}

/**
 * The quarterly impact summary.
 *
 * Reads the same `ClinicAnalytics` the admin screen renders, so the email and the page can never
 * disagree — a report that contradicted the dashboard it was generated from would cost more trust
 * than it earned.
 */
export function buildReportEmail(
  analytics: ClinicAnalytics,
  clinic: EmailClinic,
  recipient: EmailPatient
): BuiltEmail {
  const copy = emailCopy(recipient.locale);
  /*
    The range is stated in UTC, not the clinic's zone. Its bounds are UTC instants — a quarter ends
    at 23:59:59.999Z — and formatting that inclusive end in a UTC+4 clinic rolled it into the next
    day, so a Q3 report claimed to cover into October. The reminder counts behind it are windowed
    on the same UTC instants, so this is the honest label for them.
  */
  const from = zonedDate(new Date(analytics.range.from), 'UTC');
  const to = zonedDate(new Date(analytics.range.to), 'UTC');

  const headline = `${copy.reportHeadline} — ${analytics.range.label}`;

  const delivered = analytics.delivery.push.delivered + analytics.delivery.email.delivered;

  const kpis = `
    <tr><td style="padding:20px 24px 0 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="6">
        <tr>
          ${kpi(copy.reportPatients, String(analytics.activePatients))}
          ${kpi(copy.reportRemindersSent, String(delivered))}
        </tr>
        <tr>
          ${kpi(copy.reportAdherence, percent(analytics.adherenceRate, copy))}
          ${kpi(copy.reportHoursSaved, `~${analytics.hoursSaved.hours}h`)}
        </tr>
      </table>
    </td></tr>`;

  const bars = `
    <tr><td style="padding:20px 24px 0 24px;">
      <h2 style="margin:0 0 10px 0;font-size:16px;font-weight:600;color:${BRAND};">
        📶 ${escapeHtml(copy.reportDelivery)}
      </h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${deliveryBar(copy.reportPush, analytics.delivery.push, copy)}
        ${deliveryBar(copy.reportEmail, analytics.delivery.email, copy)}
      </table>
    </td></tr>
    <tr><td style="padding:20px 24px 0 24px;">
      <h2 style="margin:0 0 10px 0;font-size:16px;font-weight:600;color:${BRAND};">
        🌍 ${escapeHtml(copy.reportLanguages)}
      </h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${analytics.locales
    .map(split =>
      bar(split.locale === 'ka' ? 'ქართული' : 'English', String(split.count), split.share)
    )
    .join('')}
      </table>
    </td></tr>`;

  const sections = [
    section('👋', copy.reportIntro, paragraph(escapeHtml(analytics.clinicName))),
    kpis,
    bars,
    section('💡', copy.reportInsights, insight(analytics, copy)),
    section(
      '',
      '',
      paragraph(
        escapeHtml(copy.reportEstimateNote.replace('{from}', from).replace('{to}', to))
      )
    ),
  ].join('');

  const lines = [
    analytics.clinicName,
    `${copy.reportPatients}: ${analytics.activePatients}`,
    `${copy.reportRemindersSent}: ${delivered}`,
    `${copy.reportAdherence}: ${percent(analytics.adherenceRate, copy)}`,
    `${copy.reportHoursSaved}: ~${analytics.hoursSaved.hours}h`,
    copy.reportEstimateNote.replace('{from}', from).replace('{to}', to),
  ];

  return {
    subject: `${copy.reportSubject} — ${analytics.range.label}`,
    html: shell(headline, sections, clinic, copy),
    text: toPlainText(headline, lines, clinic, copy),
  };
}
