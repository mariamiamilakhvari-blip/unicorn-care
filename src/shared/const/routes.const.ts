export const AUTH_ROUTES = ['/sign-in', '/sign-up'];

/** Where clinics actually register, and where a clinic-less account is sent to finish setup. */
export const CLINIC_SIGN_UP_ROUTE = '/clinic-sign-up';

export const PROTECTED_ROUTES = ['/dashboard'];

export const PATIENT_PORTAL_ROUTE = '/p';

export const PATIENT_COOKIE_NAME = 'uc_patient';

export const LINK_EXPIRED_ROUTE = '/link-expired';

export const SIGN_IN_ROUTE = '/sign-in';

export const DASHBOARD_ROUTE = '/dashboard';

/** The legal documents the registration consents point at. */
export const TERMS_ROUTE = '/terms';

export const PRIVACY_ROUTE = '/privacy';

/** Where a freshly registered clinic lands: it has a trial but has not chosen a plan yet. */
export const PRICING_ROUTE = '/pricing';

export const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];
