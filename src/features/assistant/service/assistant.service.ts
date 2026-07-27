import { AssistantReply } from '@/features/assistant/types/assistant.types';
import { AskAssistantType } from '@/features/assistant/validations/assistant.validation';
import { getPortalPlanService } from '@/features/care-plan/service/patient-portal.service';
import { PortalOccurrence, PortalPlanView } from '@/features/care-plan/types/portal.types';
import { clinicRepository } from '@/features/clinic/repository/clinic.repository';
import {
  ASSISTANT_RATE_LIMIT,
  ASSISTANT_RATE_WINDOW_MS,
  ASSISTANT_SYSTEM_PROMPT,
} from '@/shared/const/assistant.const';
import { ChatMessage, openRouterClient } from '@/shared/lib/openrouter-client';
import { rateLimit } from '@/shared/lib/rate-limit';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';

/**
 * What the patient sees when the model is unreachable. It deliberately points at the clinic rather
 * than apologising for a technical fault — a post-op patient needs a next action, not an error.
 */
const FALLBACK: Record<AppLocale, string> = {
  en: 'I cannot answer right now. Your plan is still shown above, and your clinic can answer anything it does not cover.',
  ka: 'ამჟამად პასუხის გაცემა ვერ შევძელი. თქვენი გეგმა ზემოთ ჩანს, დანარჩენზე კი კლინიკა გიპასუხებთ.',
};

/** Named so the prompt's LANGUAGE rule reads as an instruction, not a locale code. */
const LANGUAGE_NAME: Record<AppLocale, string> = {
  en: 'English',
  ka: 'Georgian (ქართული)',
};

/** Still actionable: a sent reminder the patient has neither done nor skipped still counts. */
const OPEN_STATUSES = ['pending', 'sent'];

/**
 * Picks the next still-open occurrence of a kind.
 *
 * This exists because the model cannot be trusted to do it. Given a list of timestamps it read the
 * plan correctly and then named the wrong dose — off by a day — which for a dosing question is a
 * patient-safety defect, not a cosmetic one. Resolution happens here, in code, and the model is
 * told to repeat the answer rather than derive it.
 */
function findNextOpen(
  plan: PortalPlanView,
  kind: PortalOccurrence['kind'],
  now: number
): PortalOccurrence | null {
  const candidates = plan.days
    .flatMap(day => day.occurrences)
    .filter(item => item.kind === kind)
    .filter(item => OPEN_STATUSES.includes(item.status))
    .filter(item => new Date(item.dueAt).getTime() >= now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return candidates[0] ?? null;
}

/** Clinic-local wall clock. A patient should never be handed a raw UTC instant to decode. */
function formatLocal(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/**
 * Checkup bodies are deliberately excluded.
 *
 * The generator writes them relative to the *reminder* ("Tomorrow 15:00"), which is right when the
 * push fires 24h ahead and wrong everywhere else — the assistant may quote one six days early. The
 * absolute time above is the only trustworthy rendering here.
 */
function describe(
  occurrence: PortalOccurrence | null,
  timezone: string,
  fallback: string
): string {
  if (!occurrence) return fallback;

  const when = formatLocal(occurrence.dueAt, timezone);
  const detail = occurrence.kind === 'checkup' ? '' : occurrence.body;
  const suffix = detail ? ` — ${detail}` : '';

  return `${when} (clinic time) — "${occurrence.title}"${suffix}`;
}

/** The pre-computed answers to every timing question the assistant is allowed to be asked. */
function buildResolvedFacts(plan: PortalPlanView, timezone: string): string {
  const now = new Date(plan.todayIso).getTime();
  const none = 'none scheduled in the visible window';

  const overdue = plan.days
    .flatMap(day => day.occurrences)
    .filter(item => OPEN_STATUSES.includes(item.status))
    .filter(item => new Date(item.dueAt).getTime() < now).length;

  return [
    'RESOLVED FACTS (already computed — repeat these, never recalculate)',
    'All times below are the clinic\'s local time. State them exactly as written; do not convert.',
    `Next medication dose: ${describe(findNextOpen(plan, 'medication', now), timezone, none)}`,
    `Next rehab task: ${describe(findNextOpen(plan, 'rehab', now), timezone, none)}`,
    `Next checkup: ${describe(plan.nextCheckup, timezone, none)}`,
    `Items past due and not yet marked done: ${overdue}`,
  ].join('\n');
}

/**
 * Renders the patient's own plan as plain text for the model to answer from.
 *
 * Only the fields the patient can already see in the portal go in. No diagnosis, no procedure name,
 * no clinician notes — the assistant navigates the plan, so it needs the plan and nothing more.
 */
function buildPlanContext(plan: PortalPlanView, locale: AppLocale, timezone: string): string {
  const lines: string[] = [
    `RESPONSE LANGUAGE: ${LANGUAGE_NAME[locale]}.`,
    '',
    buildResolvedFacts(plan, timezone),
    '',
    "PLAN CONTEXT (this is the patient's actual prescribed plan — answer from it)",
    `Current time (UTC): ${plan.todayIso}. Clinic timezone: ${timezone}.`,
  ];

  if (plan.rehabEndsAt) lines.push(`Rehabilitation ends: ${plan.rehabEndsAt}.`);

  if (plan.nextCheckup) {
    lines.push(`Next checkup: "${plan.nextCheckup.title}" at ${plan.nextCheckup.dueAt}.`);
  }

  if (plan.days.length === 0) {
    lines.push('There are no scheduled items in the visible window.');
    return lines.join('\n');
  }

  lines.push('Scheduled items:');
  for (const day of plan.days) {
    for (const occurrence of day.occurrences) {
      const intensity = occurrence.intensity ? ` intensity=${occurrence.intensity}` : '';
      lines.push(
        `- [${occurrence.kind}] ${occurrence.dueAt} "${occurrence.title}" ${occurrence.body}` +
          `${intensity} status=${occurrence.status}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * The system prompt is always rebuilt server-side and placed first, so client-supplied history can
 * never override the assistant's scope limits (PRD 07).
 *
 * Scope rules and plan context share ONE system message. Verified against the live model: as a
 * second, separate system message the plan was ignored — asked for its own next dose the model
 * answered "I don't have that information" while the data sat in the very next message. Merged,
 * it answers correctly and the escalation rules still hold.
 */
function buildMessages(
  input: AskAssistantType,
  plan: PortalPlanView,
  locale: AppLocale,
  timezone: string
): ChatMessage[] {
  const context = buildPlanContext(plan, locale, timezone);

  return [
    { role: 'system', content: `${ASSISTANT_SYSTEM_PROMPT}\n\n${context}` },
    ...input.history.map(turn => ({ role: turn.role, content: turn.content })),
    { role: 'user', content: input.question },
  ];
}

export async function askAssistantService(
  patientId: string,
  clinicId: string,
  locale: AppLocale,
  input: AskAssistantType
): Promise<ServiceResult<AssistantReply>> {
  const allowed = await rateLimit.check(
    `assistant:${patientId}`,
    ASSISTANT_RATE_LIMIT,
    ASSISTANT_RATE_WINDOW_MS
  );
  if (!allowed) return { data: { error: 'RATE_LIMITED' }, status: 429 };

  const planResult = await getPortalPlanService(patientId, clinicId);
  if ('error' in planResult.data) return { data: { error: 'PLAN_UNAVAILABLE' }, status: 502 };

  // The clinic's zone is what every prescribed time was written in, so it is what the patient is
  // told. Falling back to UTC would silently shift every dose time by the offset.
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) return { data: { error: 'CLINIC_NOT_FOUND' }, status: 404 };

  const result = await openRouterClient.chat(
    buildMessages(input, planResult.data, locale, clinic.timezone)
  );

  // An upstream outage degrades to the fallback rather than surfacing as a failed request — the
  // patient still has their plan on screen either way.
  if (!result.ok) {
    return { data: { content: FALLBACK[locale], isFallback: true }, status: 200 };
  }

  return { data: { content: result.content, isFallback: false }, status: 200 };
}
