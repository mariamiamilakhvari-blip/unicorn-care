/**
 * The two data subject requests the platform can carry, and the states they move through.
 *
 * Access is absent on purpose. Under the Law of Georgia on Personal Data Protection a patient is
 * entitled to a copy of what is held about them, and the portal answers that immediately from
 * `buildPatientExportService` — routing it through a clinic queue would turn a right the platform
 * can satisfy in one request into a wait for someone to press a button.
 */
export const DATA_REQUEST_KINDS = ['correction', 'erasure'] as const;

export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];

/**
 * `refused` sits beside `completed` rather than under it.
 *
 * A clinic that cannot erase a medication log because the Law on Health Care requires it to be
 * kept has not failed to answer the request — it has answered it. Recording that as anything other
 * than a distinct, reasoned outcome would leave the patient without the written basis they are
 * owed, and the clinic without evidence it responded at all.
 */
export const DATA_REQUEST_STATUSES = ['open', 'completed', 'refused'] as const;

export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

/** Upper bound on the patient's free-text description. Long enough to explain, bounded for storage. */
export const DATA_REQUEST_DETAIL_MAX = 2000;

/**
 * Where the export downloads from.
 *
 * The full path, not the `/api` suffix the `http` client takes, because this one is reached by an
 * anchor rather than by fetch — the browser has to save the file itself. Held here so the link and
 * the route cannot drift apart.
 */
export const DATA_EXPORT_PATH = '/api/patient-portal/data-export';
