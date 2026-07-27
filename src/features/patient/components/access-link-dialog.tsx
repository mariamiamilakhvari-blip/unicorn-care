'use client';

import { Copy, Link2, ShieldOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAccessLink } from '@/features/patient/hooks/use-access-link';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';

type AccessLinkDialogProps = {
  patientId: string;
};

export function AccessLinkDialog({ patientId }: AccessLinkDialogProps) {
  const t = useTranslations('patient');
  const tCommon = useTranslations('common');
  const { link, isPending, hasError, issue, revoke, clear } = useAccessLink();
  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setIsCopied(true);
  }

  function handleOpenChange(open: boolean) {
    if (open) return;
    clear();
    setIsCopied(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="size-4" aria-hidden />
          {t('accessLink')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('accessLink')}</DialogTitle>
          <DialogDescription>{t('accessLinkOnceWarning')}</DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={link.url} />
              <Button type="button" onClick={() => void handleCopy()}>
                <Copy className="size-4" aria-hidden />
                {isCopied ? t('linkCopied') : t('copyLink')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('accessLinkOnceWarning')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button type="button" disabled={isPending} onClick={() => void issue(patientId)}>
              {t('createAccessLink')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => void revoke(patientId)}
            >
              <ShieldOff className="size-4" aria-hidden />
              {t('revokeAccessLink')}
            </Button>
          </div>
        )}

        {hasError && <p className="text-sm font-medium text-destructive">{tCommon('error')}</p>}
      </DialogContent>
    </Dialog>
  );
}
