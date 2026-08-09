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

export const PATIENT_COOKIE_NAME = 'uc_patient';

export const LINK_EXPIRED_ROUTE = '/link-expired';

export const SIGN_IN_ROUTE = '/sign-in';

export const DASHBOARD_ROUTE = '/dashboard';

/** The platform console. Admins land here instead of the clinic overview, which they cannot use. */
export const ADMIN_ROUTE = '/dashboard/admin';

/** The legal documents the registration consents point at. */
export const TERMS_ROUTE = '/terms';

export const PRIVACY_ROUTE = '/privacy';

/** The HIPAA Business Associate Agreement, linked from the consent block and the footer. */
export const BAA_ROUTE = '/baa';

/** Where a freshly registered clinic lands: it has a trial but has not chosen a plan yet. */
export const PRICING_ROUTE = '/pricing';

export const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];
