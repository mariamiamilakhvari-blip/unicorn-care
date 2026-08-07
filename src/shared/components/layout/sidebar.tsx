'use client';
import { Building2, LayoutDashboard, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { SIDEBAR_NAV_ITEMS, type SidebarNavItem } from '@/shared/const/navigation.const';
import { cn } from '@/shared/lib/utils';

const SIDEBAR_ICON_MAP: Record<SidebarNavItem['icon'], LucideIcon> = {
  dashboard: LayoutDashboard,
  patients: Users,
  clinic: Building2,
  admin: ShieldCheck,
};

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export const Sidebar = ({ className, onNavigate }: SidebarProps) => {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { data: session } = useSession();
  /*
    Drives which items are listed, nothing more. An item hidden here is still reachable by typing
    the URL — the page redirects and its routes re-check the role server-side, which is where the
    actual restriction lives.
  */
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';

  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-3',
        className
      )}
    >
      <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t('workspace')}
      </p>
      <nav className="flex flex-col gap-1">
        {SIDEBAR_NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role)).map(
          ({ href, labelKey, icon }) => {
            const Icon = SIDEBAR_ICON_MAP[icon];
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {t(labelKey)}
              </Link>
            );
          }
        )}
      </nav>
    </aside>
  );
};
