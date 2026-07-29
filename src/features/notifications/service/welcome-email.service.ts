import {
  badge,
  escapeHtml,
  list,
  muted,
  paragraph,
  section,
  shell,
  toPlainText,
  zonedDate,
  zonedTime,
} from '@/features/notifications/service/email-layout.service';
import {
  BuiltEmail,
  EmailGuide,
  EmailMedication,
  EmailRehabTask,
  WelcomeEmailInput,
} from '@/features/notifications/types/email.types';
import { emailCopy, EmailCopy } from '@/shared/const/email-copy.const';
import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';

/**
 * The whole plan in one email, sent when the clinic activates it.
 *
 * Activation is the trigger rather than the patient record being saved, because seven of the nine
 * sections — medications, procedures, checkup, the guide — do not exist until a plan is built. A
 * welcome email fired on the patient row alone would arrive almost empty.
 */
export function buildWelcomeEmail(input: WelcomeEmailInput): BuiltEmail {
  const copy = emailCopy(input.patient.locale);
  const zone = input.clinic.timezone;
  const name = `${input.patient.firstName} ${input.patient.lastName}`.trim();

  const sections = [
    section('👋', copy.greeting, paragraph(`${escapeHtml(copy.greeting)}, ${escapeHtml(name)}!`)),
    procedureSection(input, copy, zone),
    medicationSection(input.medications, copy, zone),
    rehabSection(input.rehabTasks, copy),
    expectedSection(input.guide, copy),
    warningSection(input.guide, copy),
    checkupSection(input, copy, zone),
  ].join('');

  return {
    subject: `${copy.welcomeSubject} — ${input.clinic.name}`,
    html: shell(copy.welcomeSubject, sections, input.clinic, copy),
    text: toPlainText(copy.welcomeSubject, plainLines(input, copy, zone), input.clinic),
  };
}

function procedureLabel(manipulationType: string): string {
  return PROCEDURE_TYPES.find(type => type.key === manipulationType)?.key ?? manipulationType;
}

function procedureSection(input: WelcomeEmailInput, copy: EmailCopy, zone: string): string {
  if (!input.procedure) return '';
  const rows = [
    `<strong>${escapeHtml(copy.procedure)}:</strong> ${escapeHtml(
      procedureLabel(input.procedure.manipulationType)
    )} — ${escapeHtml(zonedDate(input.procedure.performedAt, zone))}`,
    `<strong>${escapeHtml(copy.doctor)}:</strong> ${escapeHtml(input.procedure.operatorName)}`,
  ];
  return section('🏥', copy.procedure, list(rows));
}

/** Name, dosage, how long the course runs and the times of day it is taken. */
export function medicationLines(
  medications: EmailMedication[],
  copy: EmailCopy,
  zone: string
): string[] {
  return medications.map(item => {
    const food = item.withFood ? copy.withFood : copy.withoutFood;
    const window = `${zonedDate(item.startsOn, zone)} – ${zonedDate(item.endsOn, zone)}`;
    const times = escapeHtml(item.timesOfDay.join(', '));
    const head = `<strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(item.dosage)}`;
    const range = `<span style="color:#6b7280;">${escapeHtml(window)}</span>`;
    return `${head}, ${times} (${escapeHtml(food)})<br />${range}`;
  });
}

function medicationSection(
  medications: EmailMedication[],
  copy: EmailCopy,
  zone: string
): string {
  if (medications.length === 0) return '';
  return section('💊', copy.medications, list(medicationLines(medications, copy, zone)));
}

export function rehabLines(tasks: EmailRehabTask[], copy: EmailCopy): string[] {
  return tasks.map(item => {
    const duration = item.durationMinutes > 0 ? ` · ${item.durationMinutes} ${copy.minutesShort}` : '';
    const detail = `${copy.intensity[item.intensity]}${duration} · ${item.timesOfDay.join(', ')}`;
    return `<strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(detail)}`;
  });
}

function rehabSection(tasks: EmailRehabTask[], copy: EmailCopy): string {
  if (tasks.length === 0) return '';
  return section('🧘', copy.dailyProcedures, list(rehabLines(tasks, copy)));
}

function expectedSection(guide: EmailGuide | null, copy: EmailCopy): string {
  if (!guide || guide.expected.length === 0) return '';
  const rows = guide.expected.map(item => {
    const days = `${copy.dayRange} ${item.fromDay}–${item.toDay}`;
    const description = item.description ? `<br />${escapeHtml(item.description)}` : '';
    return `<strong>${escapeHtml(item.title)}</strong> ${badge(days)}${description}`;
  });
  return section('✅', copy.whatIsNormal, list(rows));
}

/**
 * The half of the guide that tells a patient something is wrong. Severity is spelled out rather
 * than colour-coded, because a colour alone is meaningless to a screen reader and to anyone
 * reading in a client that strips styling.
 */
function warningSection(guide: EmailGuide | null, copy: EmailCopy): string {
  if (!guide || guide.warning.length === 0) return '';
  const rows = guide.warning.map(item => {
    const severity = copy.severity[item.severity] ?? item.severity;
    const description = item.description ? `<br />${escapeHtml(item.description)}` : '';
    return `<strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(severity)}${description}`;
  });
  return section('⚠️', copy.whenToContact, list(rows));
}

function checkupSection(input: WelcomeEmailInput, copy: EmailCopy, zone: string): string {
  const next = nextCheckup(input.checkups);
  if (!next) return '';
  const when = `${zonedDate(next.scheduledAt, zone)} · ${zonedTime(next.scheduledAt, zone)}`;
  const where = next.location ? ` — ${escapeHtml(next.location)}` : '';
  return section('📅', copy.nextCheckup, paragraph(`${escapeHtml(when)}${where}`));
}

export function nextCheckup<T extends { scheduledAt: Date }>(checkups: T[]): T | null {
  const sorted = [...checkups].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return sorted[0] ?? null;
}

function plainLines(input: WelcomeEmailInput, copy: EmailCopy, zone: string): string[] {
  const strip = (value: string) => value.replace(/<[^>]+>/g, '');
  const lines: string[] = [`${copy.greeting}, ${input.patient.firstName}!`];

  if (input.procedure) {
    lines.push(
      `${copy.procedure}: ${procedureLabel(input.procedure.manipulationType)} — ${zonedDate(input.procedure.performedAt, zone)}`,
      `${copy.doctor}: ${input.procedure.operatorName}`
    );
  }
  if (input.medications.length > 0) {
    lines.push('', copy.medications, ...medicationLines(input.medications, copy, zone).map(strip));
  }
  if (input.rehabTasks.length > 0) {
    lines.push('', copy.dailyProcedures, ...rehabLines(input.rehabTasks, copy).map(strip));
  }
  const next = nextCheckup(input.checkups);
  if (next) {
    const when = `${zonedDate(next.scheduledAt, zone)} ${zonedTime(next.scheduledAt, zone)}`;
    lines.push('', `${copy.nextCheckup}: ${when}`);
  }
  return lines;
}

/** Re-exported so `muted` stays used by the daily email without a second import path. */
export { muted };
