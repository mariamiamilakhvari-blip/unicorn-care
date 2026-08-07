export type SidebarNavItem = {
  href: string;
  /** Key into the `nav` message namespace — the label itself is never stored here. */
  labelKey: string;
  icon: 'dashboard' | 'patients' | 'clinic' | 'admin';
  /** Roles that see this item. Omitted means everyone the dashboard already admits. */
  roles?: string[];
};

/**
 * Every item is role-scoped, because the two kinds of account share a shell and nothing else.
 *
 * A platform admin has `clinicId: null` and the tenancy guard refuses them by design, so the
 * clinical pages cannot load for one — offering them produces a nav item whose only outcome is an
 * error. The admin console is the reverse: clinic staff would be redirected straight back out.
 *
 * Hiding is presentation, not protection. Each page re-checks server-side and every route behind
 * it goes through its own guard; this only stops the nav promising something it cannot deliver.
 */
const CLINIC_ROLES = ['clinic_owner', 'clinic_staff'];

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: 'dashboard', roles: CLINIC_ROLES },
  { href: '/dashboard/patients', labelKey: 'patients', icon: 'patients', roles: CLINIC_ROLES },
  { href: '/dashboard/clinic', labelKey: 'clinic', icon: 'clinic', roles: CLINIC_ROLES },
  { href: '/dashboard/admin', labelKey: 'admin', icon: 'admin', roles: ['admin'] },
];
