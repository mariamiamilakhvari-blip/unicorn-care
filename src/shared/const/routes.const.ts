/**
 * Pages a signed-in visitor has no use for, and is bounced off.
 *
 * `/reset-password` is deliberately absent. Someone already signed in on this browser may still be
 * following a reset link — bouncing them to the dashboard would consume nothing and leave them with
 * no way to finish, and the link is the credential either way.
 */
export const AUTH_ROUTES = ['/sign-in', '/sign-up', '/forgot-password'];

/** Where a visitor who cannot get in asks for a reset link. */
export const FORGOT_PASSWORD_ROUTE = '/forgot-password';

/** Where the emailed link lands. The raw token rides in `?token=`. */
export const RESET_PASSWORD_ROUTE = '/reset-password';

/** Where clinics actually register, and where a clinic-less account is sent to finish setup. */
export const CLINIC_SIGN_UP_ROUTE = '/clinic-sign-up';

export const PROTECTED_ROUTES = ['/dashboard'];

export const PATIENT_PORTAL_ROUTE = '/p';

/**
 * Where a patient manages consent, downloads their record, and files a correction or erasure
 * request. Inside `/p/` so it inherits the portal's guard and its `noindex`.
 */
export const PORTAL_PRIVACY_ROUTE = '/p/privacy';

export const PATIENT_COOKIE_NAME = 'uc_patient';

export const LINK_EXPIRED_ROUTE = '/link-expired';

/**
 * Where an emailed portal link lands. Deeper than `/p/<token>` on purpose: that path takes the
 * durable access token, this one takes the short-lived single-use link, and the two must never be
 * matched by the same route.
 */
export const PORTAL_LOGIN_ROUTE = '/p/login';

export const SIGN_IN_ROUTE = '/sign-in';

export const DASHBOARD_ROUTE = '/dashboard';

/** The platform console. Admins land here instead of the clinic overview, which they cannot use. */
export const ADMIN_ROUTE = '/dashboard/admin';

/** The legal documents the registration consents point at. */
export const TERMS_ROUTE = '/terms';

export const PRIVACY_ROUTE = '/privacy';

/**
 * The Data Processing Agreement, linked from the consent block and the footer.
 *
 * The controller–processor contract the Law of Georgia on Personal Data Protection requires
 * between a clinic and this platform. Every clinic accepts it at registration.
 */
export const DPA_ROUTE = '/dpa';

/** Where a freshly registered clinic lands: it has a trial but has not chosen a plan yet. */
export const PRICING_ROUTE = '/pricing';

export const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];
