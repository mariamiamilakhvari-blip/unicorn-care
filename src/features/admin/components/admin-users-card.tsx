'use client';

import { useTranslations } from 'next-intl';

import { useAdminUsers } from '@/features/admin/hooks/use-admin-users';
import { AdminUserView } from '@/features/admin/types/admin.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';

/**
 * Roles this console may grant. Clinic roles are absent deliberately — they carry a `clinicId`
 * that cannot be set from here, and granting one would produce an account the tenancy guard
 * admits on role and then rejects for having no clinic.
 */
const ASSIGNABLE_ROLES = ['user', 'admin'] as const;

function UserRow({
  user,
  isPending,
  onRole,
  onActive,
}: {
  user: AdminUserView;
  isPending: boolean;
  onRole: (role: 'user' | 'admin') => void;
  onActive: (isActive: boolean) => void;
}) {
  const t = useTranslations('admin');
  /*
    A clinic account's role is shown but not editable. Changing it here would strip the membership
    its clinic depends on, and the staff routes are what grant and revoke those together.
  */
  const isClinicRole = !ASSIGNABLE_ROLES.some(role => role === user.role);

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>

      <Badge variant={user.isActive ? 'secondary' : 'outline'}>
        {user.isActive ? t('active') : t('deactivated')}
      </Badge>

      {isClinicRole ? (
        <Badge variant="outline">{t(`role.${user.role}`)}</Badge>
      ) : (
        <div className="flex gap-1">
          {ASSIGNABLE_ROLES.map(role => (
            <Button
              key={role}
              type="button"
              size="sm"
              variant={user.role === role ? 'default' : 'outline'}
              disabled={isPending || user.role === role}
              onClick={() => onRole(role)}
            >
              {t(`role.${role}`)}
            </Button>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant={user.isActive ? 'outline' : 'default'}
        disabled={isPending}
        onClick={() => onActive(!user.isActive)}
      >
        {user.isActive ? t('deactivate') : t('reactivate')}
      </Button>
    </li>
  );
}

export function AdminUsersCard() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { list, isLoading, pendingId, error, search, setSearch, page, setPage, update } =
    useAdminUsers();

  const total = list?.total ?? 0;
  const pageSize = list?.pageSize ?? 20;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('users')} {total > 0 && <span className="text-muted-foreground">({total})</span>}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Input
          value={search}
          placeholder={t('searchUsers')}
          aria-label={t('searchUsers')}
          onChange={event => {
            setSearch(event.target.value);
            // A new search reads from the start; staying on page 4 of the old result is a blank list.
            setPage(1);
          }}
        />

        {error && <p className="text-sm font-medium text-destructive">{t(`error.${error}`)}</p>}

        {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

        {!isLoading && list && list.items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noUsers')}</p>
        )}

        {!isLoading && list && list.items.length > 0 && (
          <ul className="flex flex-col">
            {list.items.map(user => (
              <UserRow
                key={user.id}
                user={user}
                isPending={pendingId === user.id}
                onRole={role => void update(user.id, { role })}
                onActive={isActive => void update(user.id, { isActive })}
              />
            ))}
          </ul>
        )}

        {lastPage > 1 && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {tCommon('back')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {lastPage}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
            >
              {tCommon('next')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
