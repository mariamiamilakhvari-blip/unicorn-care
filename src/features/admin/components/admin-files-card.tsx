'use client';

import { Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { useAdminFiles } from '@/features/admin/hooks/use-admin-files';
import { AdminFileView } from '@/features/admin/types/admin.types';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { formatBytes } from '@/shared/utils/format';

function FileRow({
  file,
  isPending,
  onDelete,
}: {
  file: AdminFileView;
  isPending: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations('admin');
  const isImage = file.mimeType.startsWith('image/');

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
      {/*
        A thumbnail only for images, and only ever as an <img>. Rendering an uploaded file inline
        any other way is how a document becomes executable in the console.
      */}
      {isImage ? (
        <Image
          src={file.url}
          alt={file.name}
          width={48}
          height={48}
          unoptimized
          className="size-12 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
          {file.mimeType.split('/')[1]?.slice(0, 4) ?? '?'}
        </div>
      )}

      <div className="min-w-40 flex-1">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium underline underline-offset-4"
        >
          {file.name}
        </a>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>

      <ConfirmDialog
        title={t('deleteFile')}
        description={t('deleteFileHelp', { name: file.name })}
        confirmLabel={t('deleteFile')}
        onConfirm={onDelete}
        trigger={
          <Button type="button" size="sm" variant="outline" disabled={isPending}>
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">{t('deleteFile')}</span>
          </Button>
        }
      />
    </li>
  );
}

export function AdminFilesCard() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { list, isLoading, isUploading, pendingId, error, page, setPage, upload, remove } =
    useAdminFiles();
  const inputRef = useRef<HTMLInputElement>(null);

  const total = list?.total ?? 0;
  const pageSize = list?.pageSize ?? 20;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('files')} {total > 0 && <span className="text-muted-foreground">({total})</span>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('filesHelp')}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/*
          The native input is hidden behind a button rather than styled: file inputs cannot be
          restyled consistently across browsers, and the button is the control everything else on
          this page already looks like.
        */}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            // Cleared so choosing the same file twice in a row still fires a change event.
            event.target.value = '';
          }}
        />

        <Button
          type="button"
          className="self-start gap-2"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {isUploading ? tCommon('loading') : t('upload')}
        </Button>

        {error && <p className="text-sm font-medium text-destructive">{t(`error.${error}`)}</p>}

        {isLoading && <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>}

        {!isLoading && list && list.items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noFiles')}</p>
        )}

        {!isLoading && list && list.items.length > 0 && (
          <ul className="flex flex-col">
            {list.items.map(file => (
              <FileRow
                key={file.id}
                file={file}
                isPending={pendingId === file.id}
                onDelete={() => void remove(file.id)}
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
