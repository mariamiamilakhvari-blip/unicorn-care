# PRD 02 — Auth, Roles, and Patient Magic Link

Two completely separate access paths. They must not be confused in code.

| Path | Who | Mechanism | Route prefix |
|---|---|---|---|
| Session auth | Clinic owner / staff / admin | NextAuth v5 JWT (existing) | `/dashboard/*` |
| Token access | Patient | Opaque magic-link token in a cookie | `/p/*` |

## A. Clinic session auth

Builds on the existing NextAuth setup in `src/shared/lib/auth.ts`. Changes:

1. The `jwt` callback already refetches the user from DB each refresh — extend it to also carry
   `clinicId` onto the token, and the `session` callback to expose it. Keep the inline
   `type SessionUser = { ... }` cast pattern (CLAUDE.md §18 — **never** create `next-auth.d.ts`).
2. Extend the role union everywhere it is currently `'user' | 'admin'` to
   `'user' | 'admin' | 'clinic_owner' | 'clinic_staff'`.

### Clinic registration

`POST /api/clinic/register` — one transaction-ish flow in `clinicService.registerClinic`:
1. Create the `User` with `role: 'clinic_owner'`
2. Create the `Clinic` with `ownerId` = that user
3. Write `clinicId` back onto the user

If step 2 or 3 fails, delete the user created in step 1 (compensating delete — Mongo standalone
has no multi-doc transactions without a replica set, so do not rely on `session.withTransaction`).

### Staff invitation

`POST /api/clinic/staff` (owner only) creates a `clinic_staff` user with a generated temporary
password returned once in the response for the owner to hand over. No email is sent — the product
has no email channel at all.

### Tenancy guard — the single most important rule

Every clinical service takes `clinicId` from the **session**, never from the request body.

```ts
// src/shared/lib/clinic-guard.ts  (class + singleton, per CLAUDE.md §13, with .spec.ts)
class ClinicGuard {
  async requireClinicUser(): Promise<{ userId: string; clinicId: string; role: ClinicRole } | null>
  async requireOwner(): Promise<...>
}
export const clinicGuard = new ClinicGuard();
```

A repository method that reads clinical data **must** accept `clinicId` and include it in the
filter. There is no "find by id" without a clinic scope for `Patient`, `Procedure`, `CarePlan`,
or `ReminderOccurrence`.

## B. Patient magic link

### Issuing

Staff clicks "Create access link" on a patient. `patientAccessService.issueToken`:
1. Generate 32 random bytes → base64url → the **raw token** (~43 chars)
2. Store only `sha256(raw)` as `tokenHash`, with `expiresAt = now + 90 days`
3. Revoke any prior active tokens for that patient
4. Return the full URL `${NEXTAUTH_URL}/p/${raw}` to the UI, shown once with a copy button

Hashing uses the existing `src/shared/utils/password.ts` SHA-256 helper — same primitive the
codebase already uses, no new dependency.

### Redeeming

`GET /p/<token>` (server component / route handler):
1. Hash the token, look up by `tokenHash`
2. Reject if missing, `revokedAt != null`, or `expiresAt < now`
3. Set an httpOnly, `sameSite: 'lax'`, `secure` (prod) cookie `uc_patient` containing the
   **same raw token**, 90-day max age
4. Update `lastUsedAt`
5. Redirect to `/p` (the portal home) so the token stops appearing in the URL bar and in history

All later `/p/*` requests and `/api/patient-portal/*` calls read the cookie.

### Guard

```ts
// src/shared/lib/patient-guard.ts  (class + singleton + .spec.ts)
class PatientGuard {
  async requirePatient(): Promise<{ patientId: string; clinicId: string; locale: 'ka' | 'en' } | null>
}
export const patientGuard = new PatientGuard();
```

### Revoking

Staff can revoke from the patient page — sets `revokedAt`, and deactivates that patient's
`PushSubscription` rows so notifications stop with the link.

### Security properties

- The token is opaque and random; there is no patient identifier in it.
- Only the hash is at rest, so a DB read does not yield working links.
- Cookie is httpOnly — portal JS never reads the token.
- Expiry is bounded (90 days) and independently revocable.
- The portal exposes exactly one patient's data; every portal service call derives `patientId`
  from the guard, never from a query param.

### Rate limiting

`GET /p/<token>` is a brute-force surface. Limit redemption attempts per IP (in-memory counter in
`src/shared/lib/rate-limit.ts`, class + singleton + `.spec.ts`): 10 attempts / 10 minutes, then
429. With a 256-bit token this is belt-and-braces, but the endpoint is public and cheap to abuse.

## C. Route protection (`src/proxy.ts`)

`proxy.ts` runs in the Edge runtime and must not import Node modules or the auth config
(CLAUDE.md §5). It only inspects cookies:

```ts
export const config = {
  matcher: ['/dashboard/:path*', '/p/:path*', '/sign-in', '/sign-up'],
};
```

Rules:
- `/dashboard/*` without `authjs.session-token` → redirect `/sign-in?callbackUrl=...`
- `/p/*` (except `/p/<token>` redemption, which is exactly one segment and must pass through)
  without `uc_patient` cookie → redirect `/link-expired`
- Auth routes with a session → `/dashboard`

Update `src/shared/const/routes.const.ts` with `PATIENT_ROUTES` and the extended lists rather than
hardcoding paths in `proxy.ts`.
