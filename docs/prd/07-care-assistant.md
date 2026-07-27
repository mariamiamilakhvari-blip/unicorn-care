# PRD 07 — Post-Op Care Assistant

An LLM assistant inside the patient portal that helps a patient **follow the plan their clinician
already wrote**. It is a navigator, not a clinician.

## Why it is narrow

The user is post-operative. A confident wrong answer about a symptom has physical consequences,
and the platform has no clinician in the loop at answer time. So the assistant is scoped to
restating and explaining plan content, and every question that drifts toward assessment is routed
back to the clinic.

## Provider

| Setting | Value |
|---|---|
| Provider | OpenRouter (`/chat/completions`) |
| Model | `openai/gpt-oss-20b:free` (via `OPENROUTER_MODEL`) |
| Temperature | 0.2 — it restates a plan, it does not brainstorm |
| Max tokens | 600 |
| Timeout | 30s |

Env: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`.

`src/shared/lib/openrouter-client.ts` is a class + singleton with a co-located spec. It **never
throws** — a failed call returns a typed failure so an upstream outage cannot surface as a 500.

## Scope rules (enforced in `src/shared/const/assistant.const.ts`)

**Must not**: diagnose; state whether a symptom is normal or a complication; change/add/stop/re-time
any medication or task; estimate outcomes or aesthetic results; interpret photos, wounds, swelling,
bruising, discharge, or pain; contradict the clinician; invent plan details.

**Should**: answer what is in the plan (what, when, at what intensity, next checkup); explain a
prescribed task in plain language; give risk-free logistics guidance; encourage marking items done.

**Escalation overrides everything**: any symptom report, pain, fever, bleeding, discharge, swelling
change, breathing difficulty, chest pain, or worsening → state plainly it cannot judge symptoms,
tell the patient to contact the clinic, and for severe or sudden presentations tell them to seek
emergency care. Explicitly forbidden from adding "it's probably fine" reassurance — it cannot know.

## Grounding

Every request rebuilds the context server-side from `getPortalPlanService`:

- current UTC time, rehab end date, next checkup
- each scheduled occurrence: kind, due time, title, body, intensity, status

Only what the patient can already see in their portal is sent. **No diagnosis, no procedure name,
no clinician notes.** The assistant navigates the plan, so it gets the plan and nothing more.

Scope rules and plan context go in **one** system message. This is load-bearing, not cosmetic:
split across two system messages, the live model ignored the plan and answered "I don't have that
information" to a question whose answer was in the very next message. Merged, it answers correctly
and the escalation rules still hold. `assistant.service.spec.ts` guards the shape.

### RESOLVED FACTS — the model does no arithmetic

Given a list of timestamps the model read the plan correctly and still named the **wrong dose**,
off by a day. For a dosing question that is a patient-safety defect, not a formatting one.

So timing is resolved in code before the model sees anything. `buildResolvedFacts` computes and
states outright:

- next medication dose, next rehab task, next checkup
- count of items past due and not yet marked done

The prompt forbids the model from counting days, comparing timestamps, or deciding what comes
next — it repeats these lines verbatim. "Next" means the earliest occurrence that is still
`pending` or `sent` **and** not in the past; `done` and `skipped` are excluded.

All times are rendered in the **clinic's** timezone (`Clinic.timezone`), never as a raw UTC
instant. A patient should not have to decode `2026-07-28T04:00:00.000Z`.

Checkup `body` is deliberately **excluded** from the facts block. The generator writes it relative
to the reminder ("Tomorrow 15:00"), which is right when the push fires 24h ahead and wrong when the
assistant quotes it six days early.

### Response language

One rule, no ambiguity: **the patient's recorded locale wins**, never the language the question was
typed in. Previously the system prompt said "answer in the language the patient writes in" while
the context said `Patient language: ka` — the two fought and the same English question got Georgian
one time and English the next. Now the prompt carries a `RESPONSE LANGUAGE` line naming the
language, and explicitly says to ignore the question's language.

## Prompt-injection posture

- The system prompt is rebuilt server-side and placed **first** on every call.
- The client may only send `role: 'user' | 'assistant'` turns — the Zod schema has no `system`
  variant, so a client cannot smuggle in its own instructions.
- History is capped at 10 turns, 500 chars each.
- `assistant.service.spec.ts` asserts the ordering guarantee directly.

This blunts casual injection. It is not a proof against a determined jailbreak — see Limits.

## Rate limiting

20 requests / hour / patient, checked **before** the upstream call so a throttled patient costs
nothing. Uses the existing in-memory `rateLimit` singleton, which is per-instance — move it to
Redis before scaling past one instance.

## Failure behaviour

Model unreachable, unauthorized, or rate-limited upstream → HTTP **200** with a localised fallback
(`isFallback: true`) pointing at the clinic. The plan is still on screen; the patient gets a next
action, not an error page.

## Endpoint

`POST /api/patient-portal/assistant` — guarded by `patientGuard`, so `patientId` / `clinicId` /
`locale` come from the magic-link cookie, never from the body.

```
{ "question": "When is my next dose?", "history": [{ "role": "user", "content": "..." }] }
→ { "content": "...", "isFallback": false }
```

## UI

`AssistantPanel` renders **last** in the portal — the prescribed plan is the primary content, the
chat is secondary. A standing, non-dismissible disclaimer sits above the thread in the patient's
language.

## Limits — read before shipping to real patients

1. **Patient plan data leaves your infrastructure.** Medication names, dosing times, rehab tasks,
   and checkup times are sent to OpenRouter, which routes to an upstream model host. Before real
   patient use: confirm this is compatible with your jurisdiction's health-data rules (GDPR
   Art. 9 / Georgian personal data law), check OpenRouter's retention and training policy for the
   chosen model, and get explicit patient consent. A zero-data-retention provider or a self-hosted
   model is the safer posture for production.
2. **`:free` tier has no availability guarantee.** Fine — the fallback path is built for exactly
   this — but do not promise patients the assistant will answer.
3. **Prompt hardening is mitigation, not a guarantee.** Log and review a sample of real
   conversations before scaling; a scope breach here is a patient-safety incident, not a bug.
4. **No conversation persistence.** History lives in component state and dies on refresh. That is
   deliberate for v1 (nothing extra at rest), but it also means no audit trail — add server-side
   logging before you rely on point 3.
