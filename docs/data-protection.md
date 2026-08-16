# Data protection — Georgian legal compliance

What the platform does about the Law of Georgia on Personal Data Protection
(პერსონალურ მონაცემთა დაცვის შესახებ), the Law of Georgia on the Rights of the Patient
(პაციენტის უფლებების შესახებ), and the Law of Georgia on Health Care (ჯანმრთელობის დაცვის შესახებ).

This file exists because a meaningful part of compliance is deployment configuration rather than
code, and the code cannot enforce what it cannot see. Everything below is split accordingly: what
the repository guarantees, and what has to be true of the environment it is deployed into.

## Roles

The clinic is the **controller**. It decides why and how its patients' data is processed. This
platform is the **processor**, acting on the clinic's documented instructions — which is the
relationship the Data Processing Agreement (`legal-dpa.const.ts`) governs. It replaced a HIPAA
Business Associate Agreement, which reached only clinics in the United States and so reached none
of the clinics this product is built for.

## Consent

| Concern | Where |
| --- | --- |
| Intake checkboxes | `PatientConsentSchema` in `patient.validation.ts` |
| Which are processing bases | `INTAKE_CONSENT_MAP` in `consent-type.const.ts` |
| Audit trail | `ConsentRecord` — append-only, one row per purpose |
| Runtime state | `Patient.notificationsRevokedAt` / `portalAccessRevokedAt` |
| Patient self-service | `/p/privacy` → `POST /api/patient-portal/consent` |
| Staff-recorded withdrawal | `revokeConsentForPatientService` |

State is denormalised onto `Patient` deliberately: a dispatch sweep carries hundreds of rows and
cannot afford an audit query per row. `ConsentRecord` is the evidence; the flags are the decision.
Both are written on every change, audit row first.

A withdrawal binds the **sweep**, not the next regeneration — the Law says it takes effect when it
is made. `createConsentGate` in `dispatch.service.ts` withholds push and email; the row is retired
as `sent` with both delivery fields `false` and counted as `withheld`, which is kept apart from
`undelivered` so a clinic does not chase a delivery fault that does not exist.

## Patient rights

- **Access and portability** — `GET /api/patient-portal/data-export` returns the whole record as
  structured JSON, served as a download with `Cache-Control: no-store`. Answered directly, with no
  clinic queue in the way.
- **Correction and erasure** — filed from the portal, answered by the clinic. `refused` is a
  first-class outcome with a mandatory written reason, because "the Law on Health Care requires
  this to be kept" is a lawful answer the patient is entitled to receive.

## Retention

`retention.const.ts` is the authority. Clinical records are retained for
`CLINICAL_RECORD_RETENTION_YEARS` (default 15) and **no automated routine deletes inside that
window**. An erasure clears `ERASABLE_PATIENT_FIELDS` — name, phone, email, notes — and leaves the
clinical log intact but severed from those identifiers. `dateOfBirth`, `sex` and `allergies`
survive: a dose is only interpretable against them, and deleting an allergy list could injure
someone.

A clinic under a longer sectoral rule should raise the constant.

## Data minimisation

Third-party processors receive only what their function needs.

- **Email** — recipient address, subject, body. The subject carries the **time only**; the
  medication name is in the body. A subject line shows in an inbox preview and survives in provider
  logs whatever the body does.
- **Push** — an opaque endpoint and an encrypted payload. Titles and bodies are rendered at plan
  activation and never carry a diagnosis, a procedure name, or free-text clinical instructions: a
  lock-screen preview is readable by anyone holding the phone.
- **Export** — internal identifiers are omitted. They are how this platform stores the data, not
  data about the patient, and mean nothing to another controller receiving the file.

## What the deployment must provide

The repository cannot enforce these. They are properties of the hosting and database configuration,
and the DPA commits to them, so they have to be verified per environment.

### Encryption at rest — AES-256

Required of the database and object store, not the application. MongoDB Atlas encrypts at rest with
AES-256 by default; Vercel Blob likewise. **Verify** the cluster tier and configuration actually has
it enabled, and that backups and snapshots inherit it. Application-level encryption is deliberately
not used — it would break every query the product depends on and provide no protection against the
threat model that matters here, which is a lost credential rather than a stolen disk.

### Encryption in transit — TLS 1.3

- `MONGO_URI` must use `mongodb+srv://` with TLS enabled (Atlas default; do not disable it).
- All HTTP traffic terminates at Vercel's edge, which negotiates TLS 1.3 where the client supports
  it and TLS 1.2 otherwise. **TLS 1.2 remains reachable** for older clients — a patient on an old
  phone must still be able to open their plan. If a strict TLS-1.3-only posture is required, it is
  set at the platform, not here.
- HSTS is set in `next.config.ts`. Portal token links inherit it, which is the point: those URLs
  carry a credential.

### Data residency

The Law permits transfer abroad where the receiving country provides appropriate safeguards or
another statutory ground applies. In practice:

- **Database** — choose the Atlas region deliberately. The nearest options to Georgia are in the EU
  (`eu-central-1`, Frankfurt). Record the choice; it is what the DPA's residency paragraph refers to.
- **Hosting** — set Vercel's function region to match, so compute and data sit in the same place.
- **Sub-processors** — hosting, database, object storage, email, push, payments. The Privacy Policy
  names the current list, and the DPA commits to notice before a change.

A clinic that requires its data to remain in a specific jurisdiction must be handled before it
enters any patient data. There is no per-clinic residency control in the product.

### Operational

- Restrict database network access to the deployment; no open IP allowlists.
- Keep production data access to the people who need it, under the confidentiality terms the DPA
  states.
- Breach notification to the Personal Data Protection Service is the **clinic's** obligation as
  controller. The platform's obligation is to tell the clinic without undue delay, with enough
  detail for them to file.
