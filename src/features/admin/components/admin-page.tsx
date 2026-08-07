'use client';

import { useTranslations } from 'next-intl';

import { AdminFilesCard } from '@/features/admin/components/admin-files-card';
import { AdminUsersCard } from '@/features/admin/components/admin-users-card';
import { AnalyticsCard } from '@/features/analytics/components/analytics-card';

/** The platform console. Users first: it is the reason an admin opens this page. */
export function AdminPage() {
  const t = useTranslations('admin');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
      <AnalyticsCard />
      <AdminUsersCard />
      <AdminFilesCard />
    </div>
  );
}
