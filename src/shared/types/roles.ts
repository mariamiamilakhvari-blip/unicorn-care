/**
 * Cross-feature role and locale unions.
 *
 * `UserRole` is the widened NextAuth session role (PRD 02 §A).
 * `ClinicRole` is the subset that may touch clinical data.
 */
export type UserRole = 'user' | 'admin' | 'clinic_owner' | 'clinic_staff';

export type ClinicRole = 'clinic_owner' | 'clinic_staff';

export type AppLocale = 'ka' | 'en';

export const CLINIC_ROLES: ClinicRole[] = ['clinic_owner', 'clinic_staff'];
