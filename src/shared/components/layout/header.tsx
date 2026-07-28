'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { useLogout } from '@/features/auth/hooks/use-logout';
import { BrandMark } from '@/shared/components/layout/brand-mark';
import { LanguageSwitcher } from '@/shared/components/layout/language-switcher';
import { ThemeToggle } from '@/shared/components/layout/theme-toggle';
import { Button } from '@/shared/components/ui/button';
import { APP_NAME } from '@/shared/const/app.const';
import { CLINIC_SIGN_UP_ROUTE } from '@/shared/const/routes.const';
import { CLINIC_ROLES, type UserRole } from '@/shared/types/roles';

type SessionUser = {
  name?: string | null;
  avatar?: string | null;
  role?: UserRole;
  clinicId?: string | null;
};

/** Same set the protected layout admits — the link must not point somewhere that redirects away. */
const DASHBOARD_ROLES: UserRole[] = [...CLINIC_ROLES, 'admin'];

export const Header = () => {
  const { data: session } = useSession();
  const { logout } = useLogout();
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const tClinic = useTranslations('clinic');
  const tPricing = useTranslations('pricing');
  const sessionUser = session?.user as SessionUser | undefined;
  const userName = sessionUser?.name ?? '';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <header className="flex items-center justify-between px-6 py-5 sm:px-10 border-b border-border">
      <Link href="/" className="flex items-center gap-2.5">
        <BrandMark size={32} />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {APP_NAME}
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />

        {/* Outside the signed-in/out branches: a clinic on the trial needs to reach pricing too. */}
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-accent">
          <Link href="/pricing">{tPricing('title')}</Link>
        </Button>

        {sessionUser ? (
          <>
            {/* A signed-in account with no clinic gets a way back into setup instead of a dead end. */}
            {sessionUser.role && DASHBOARD_ROLES.includes(sessionUser.role) ? (
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-accent">
                <Link href="/dashboard">{tNav('dashboard')}</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-accent">
                <Link href={CLINIC_SIGN_UP_ROUTE}>{tClinic('finishSetup')}</Link>
              </Button>
            )}
            <div className="flex items-center gap-3">
              {sessionUser.avatar ? (
                <Image
                  src={sessionUser.avatar}
                  alt={userName}
                  width={32}
                  height={32}
                  className="size-8 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="size-8 rounded-full border border-border bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
                  {initials || 'U'}
                </div>
              )}
              <span className="text-sm text-muted-foreground hidden sm:block">{userName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              {tAuth('signOut')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <Link href="/sign-in">{tAuth('signIn')}</Link>
            </Button>
            <Button size="sm" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
              <Link href={CLINIC_SIGN_UP_ROUTE}>{tAuth('signUp')}</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
};
