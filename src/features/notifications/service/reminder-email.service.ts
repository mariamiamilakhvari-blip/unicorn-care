import {
  escapeHtml,
  muted,
  paragraph,
  portalCta,
  portalCtaLines,
  section,
  shell,
  toPlainText,
  zonedTime,
} from '@/features/notifications/service/email-layout.service';
import { BuiltEmail, ReminderEmailInput } from '@/features/notifications/types/email.types';
import { emailCopy } from '@/shared/const/email-copy.const';

/**
 * The timed reminder: one dose or one task, sent at the moment it falls due.
 *
 * Deliberately the smallest email the product sends. It arrives while the patient is meant to be
 * doing something — taking a tablet, starting a rehab session — so it says what and when, and
 * offers one way through to the rest. A digest here would bury the instruction it exists to give.
 *
 * `title` and `body` come off the occurrence unchanged. They were rendered in the patient's
 * locale at plan activation, which is what keeps dispatch a pure read: no clinical text is
 * composed at send time, by this or anything else in the sweep.
 *
 * The time shown is the *dose* time the clinic prescribed, and the send time is that minus the
 * lead the clinic set. Printing the send time instead would tell a patient with a 5-minute lead
 * to take their tablet five minutes early, every time.
 */
export function buildReminderEmail(input: ReminderEmailInput): BuiltEmail {
  const copy = emailCopy(input.patient.locale);
  const at = zonedTime(input.dueAt, input.clinic.timezone);

  const heading = `${copy.reminderSubject} — ${at}`;

  const sections = [
    section(
      '⏰',
      copy.reminderDue,
      [
        paragraph(`<strong>${escapeHtml(input.title)}</strong>`),
        input.body ? paragraph(escapeHtml(input.body)) : '',
        muted(`${copy.reminderAt} ${at}`),
      ].join('')
    ),
    portalCta(copy),
  ].join('');

  const lines = [
    ...[input.title, input.body, `${copy.reminderAt} ${at}`].filter(Boolean),
    ...portalCtaLines(copy),
  ];

  return {
    subject: `${copy.reminderSubject}: ${input.title}`,
    html: shell(heading, sections, input.clinic, copy),
    text: toPlainText(heading, lines, input.clinic, copy),
  };
}
