import {
  badge,
  escapeHtml,
  list,
  muted,
  paragraph,
  portalCta,
  portalCtaLines,
  section,
  shell,
  toPlainText,
  zonedDate,
  zonedTime,
} from '@/features/notifications/service/email-layout.service';
import {
  medicationLines,
  rehabLines,
} from '@/features/notifications/service/welcome-email.service';
import { BuiltEmail, DailyEmailInput, EmailGuide } from '@/features/notifications/types/email.types';
import { emailCopy, EmailCopy } from '@/shared/const/email-copy.const';
import { isWarningSeverity } from '@/shared/const/recovery.const';

/**
 * One email per recovery day, carrying only what applies to that day.
 *
 * The full plan already went out in the welcome email; repeating it daily would train the patient
 * to stop reading. What changes day to day is the doses due, the sessions due, how close the
 * checkup is, and which guide entries are still in their day window — so that is all this contains.
 */
export function buildDailyEmail(input: DailyEmailInput): BuiltEmail {
  const copy = emailCopy(input.patient.locale);
  const zone = input.clinic.timezone;

  const sections = [
    section(
      '👋',
      copy.greeting,
      paragraph(`${escapeHtml(copy.greeting)}, ${escapeHtml(input.patient.firstName)}!`)
    ),
    medicationSection(input, copy, zone),
    rehabSection(input, copy),
    checkupSection(input, copy, zone),
    expectedSection(input.guide, input.recoveryDay, copy),
    warningSection(input.guide, input.recoveryDay, copy),
    /*
      Last, after the day's content. This is the email a patient receives most often, and until
      now it was the only patient-facing template with no way back into the portal — so the
      message that arrives every day was the one that could not be acted on.
    */
    portalCta(copy),
  ].join('');

  return {
    subject: `${copy.dailySubject} — ${zonedDate(new Date(), zone)}`,
    html: shell(copy.dailySubject, sections, input.clinic, copy),
    text: toPlainText(
      copy.dailySubject,
      [...plainLines(input, copy, zone), ...portalCtaLines(copy)],
      input.clinic,
      copy
    ),
  };
}

function medicationSection(input: DailyEmailInput, copy: EmailCopy, zone: string): string {
  const body =
    input.medications.length > 0
      ? list(medicationLines(input.medications, copy, zone))
      : muted(copy.noneToday);
  return section('💊', copy.todayMedications, body);
}

function rehabSection(input: DailyEmailInput, copy: EmailCopy): string {
  if (input.rehabTasks.length === 0) return '';
  return section('🧘', copy.todayProcedures, list(rehabLines(input.rehabTasks, copy)));
}

function checkupSection(input: DailyEmailInput, copy: EmailCopy, zone: string): string {
  if (!input.nextCheckup || input.daysUntilCheckup === null) return '';

  const countdown =
    input.daysUntilCheckup <= 0
      ? copy.today
      : `${input.daysUntilCheckup} ${copy.daysUnit}`;
  const date = zonedDate(input.nextCheckup.scheduledAt, zone);
  const time = zonedTime(input.nextCheckup.scheduledAt, zone);
  const when = `${date} · ${time}`;
  const where = input.nextCheckup.location ? ` — ${escapeHtml(input.nextCheckup.location)}` : '';

  return section(
    '📅',
    copy.daysUntilCheckup,
    paragraph(`<strong>${escapeHtml(countdown)}</strong> · ${escapeHtml(when)}${where}`)
  );
}

/** Only the entries whose day window covers today — the rest are not this patient's problem yet. */
export function applicableOnDay<T extends { fromDay: number; toDay: number }>(
  entries: T[],
  recoveryDay: number
): T[] {
  return entries.filter(entry => recoveryDay >= entry.fromDay && recoveryDay <= entry.toDay);
}

function expectedSection(guide: EmailGuide | null, day: number, copy: EmailCopy): string {
  if (!guide) return '';
  const applicable = applicableOnDay(guide.expected, day);
  if (applicable.length === 0) return '';

  const rows = applicable.map(item => {
    const description = item.description ? `<br />${escapeHtml(item.description)}` : '';
    const days = badge(`${copy.dayRange} ${item.fromDay}–${item.toDay}`);
    return `<strong>${escapeHtml(item.title)}</strong> ${days}${description}`;
  });
  return section('✅', copy.whatIsNormal, list(rows));
}

function warningSection(guide: EmailGuide | null, day: number, copy: EmailCopy): string {
  if (!guide) return '';
  const applicable = applicableOnDay(guide.warning, day);
  if (applicable.length === 0) return '';

  const rows = applicable.map(item => {
    const severity = isWarningSeverity(item.severity) ? copy.severity[item.severity] : item.severity;
    const description = item.description ? `<br />${escapeHtml(item.description)}` : '';
    return `<strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(severity)}${description}`;
  });
  return section('⚠️', copy.whenToContact, list(rows));
}

function plainLines(input: DailyEmailInput, copy: EmailCopy, zone: string): string[] {
  const strip = (value: string) => value.replace(/<[^>]+>/g, '');
  const lines = [`${copy.greeting}, ${input.patient.firstName}!`, '', copy.todayMedications];

  lines.push(
    ...(input.medications.length > 0
      ? medicationLines(input.medications, copy, zone).map(strip)
      : [copy.noneToday])
  );

  if (input.rehabTasks.length > 0) {
    lines.push('', copy.todayProcedures, ...rehabLines(input.rehabTasks, copy).map(strip));
  }
  if (input.nextCheckup && input.daysUntilCheckup !== null) {
    const countdown =
      input.daysUntilCheckup <= 0 ? copy.today : `${input.daysUntilCheckup} ${copy.daysUnit}`;
    lines.push('', `${copy.daysUntilCheckup}: ${countdown}`);
  }
  return lines;
}
