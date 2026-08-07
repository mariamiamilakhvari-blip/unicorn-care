'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminUserListView } from '@/features/admin/types/admin.types';
import { UpdateAdminUserType } from '@/features/admin/validations/admin.validation';
import { http } from '@/shared/lib/http';

type AdminUsersState = {
  list: AdminUserListView | null;
  isLoading: boolean;
  pendingId: string | null;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (value: number) => void;
  update: (id: string, input: UpdateAdminUserType) => Promise<void>;
};

export function useAdminUsers(): AdminUsersState {
  const [list, setList] = useState<AdminUserListView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      setList(await http.get<AdminUserListView>(`/admin/users?${params}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * `pendingId` rather than a single `isPending`: the table has a control per row, and one shared
   * flag would disable every row while any one of them saves.
   *
   * The list is reloaded rather than patched in place, because the server may have refused — the
   * last-admin rule and the self-modification rule both live there, and a locally-applied change
   * would show a role that was never saved.
   */
  const update = useCallback(
    async (id: string, input: UpdateAdminUserType) => {
      setPendingId(id);
      setError(null);
      try {
        await http.patch(`/admin/users/${id}`, input);
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
      } finally {
        setPendingId(null);
      }
    },
    [load]
  );

  return { list, isLoading, pendingId, error, search, setSearch, page, setPage, update };
}
