export type SidebarNavItem = {
  href: string;
  /** Key into the `nav` message namespace — the label itself is never stored here. */
  labelKey: string;
  icon: 'dashboard' | 'patients' | 'clinic';
};

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: 'dashboard' },
  { href: '/dashboard/patients', labelKey: 'patients', icon: 'patients' },
  { href: '/dashboard/clinic', labelKey: 'clinic', icon: 'clinic' },
];
