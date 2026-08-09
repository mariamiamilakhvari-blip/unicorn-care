'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/shared/components/ui/button';

type PhotoStripProps = {
  photoIds: string[];
  onDelete: (photoId: string) => Promise<boolean>;
};

/**
 * The photographs attached to one entry.
 *
 * `src` points at the app's own proxy, never at blob storage — the bytes are private, and the
 * route is where the authorisation check and the access-log write happen. Every one of these
 * images is a logged read, which is the intended cost of showing them at all.
 *
 * `loading="lazy"` matters more than usual here: each visible thumbnail is a function invocation
 * streaming megabytes, so photographs further down a long recovery are not fetched until someone
 * scrolls to them.
 */
export function RecoveryPhotoStrip({ photoIds, onDelete }: PhotoStripProps) {
  const t = useTranslations('recoveryLog');
  const [removing, setRemoving] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);

  const visible = photoIds.filter(id => !gone.includes(id));
  if (visible.length === 0) return null;

  async function handleDelete(photoId: string) {
    setRemoving(photoId);
    try {
      if (await onDelete(photoId)) setGone(current => [...current, photoId]);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {visible.map(photoId => (
        <li key={photoId} className="flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image cannot optimise a
              private, no-store route: it would fetch and cache the bytes on the CDN, which is
              precisely what this storage design exists to prevent. */}
          <img
            src={`/api/blobs/${photoId}`}
            alt={t('photoAlt')}
            loading="lazy"
            className="size-24 rounded-md border border-border object-cover"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={removing === photoId}
            onClick={() => void handleDelete(photoId)}
          >
            <Trash2 className="size-4" aria-hidden />
            {t('deletePhoto')}
          </Button>
        </li>
      ))}
    </ul>
  );
}
