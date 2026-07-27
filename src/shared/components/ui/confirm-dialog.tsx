'use client';

import { useTranslations } from 'next-intl';
import { ReactNode, useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  /** Say what will be destroyed, not just "are you sure" — the user needs the consequence. */
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function confirm() {
    setIsPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirm()}
            disabled={isPending}
          >
            {isPending ? tCommon('loading') : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
