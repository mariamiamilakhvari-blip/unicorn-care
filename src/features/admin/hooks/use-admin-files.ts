'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminFileListView } from '@/features/admin/types/admin.types';
import { http } from '@/shared/lib/http';

type AdminFilesState = {
  list: AdminFileListView | null;
  isLoading: boolean;
  isUploading: boolean;
  pendingId: string | null;
  error: string | null;
  page: number;
  setPage: (value: number) => void;
  upload: (file: File) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function useAdminFiles(): AdminFilesState {
  const [list, setList] = useState<AdminFileListView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setList(await http.get<AdminFileListView>(`/admin/files?page=${page}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * `fetch` directly rather than the shared `http` client: that client sets a JSON content type
   * and stringifies the body, and a multipart upload needs the browser to set the boundary itself.
   * Error handling is duplicated here for the same reason — a few lines is cheaper than a second
   * code path inside the client that every JSON caller would then have to read past.
   */
  const upload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);
      try {
        const body = new FormData();
        body.append('file', file);

        const response = await fetch('/api/admin/files', { method: 'POST', body });
        if (!response.ok) {
          const failure = await response.json().catch(() => ({}));
          throw new Error(failure.error ?? 'UPLOAD_FAILED');
        }
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
      } finally {
        setIsUploading(false);
      }
    },
    [load]
  );

  const remove = useCallback(
    async (id: string) => {
      setPendingId(id);
      setError(null);
      try {
        await http.delete(`/admin/files/${id}`);
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'ERROR');
      } finally {
        setPendingId(null);
      }
    },
    [load]
  );

  return { list, isLoading, isUploading, pendingId, error, page, setPage, upload, remove };
}
