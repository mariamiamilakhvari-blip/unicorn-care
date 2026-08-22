'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

type DeletePatientDialogProps = {
  patientId: string;
  patientName: string;
  onDelete: (id: string, confirmationName: string) => Promise<void>;
};

/**
 * The typed gate on patient erasure.
 *
 * A `ConfirmDialog` stood here, which is one click — and this destroys the whole clinical record:
 * the plans, the adherence history, the post-operative photographs, the ratings. Account deletion
 * has always required the clinic's name typed out for the same reason, and erasing a patient is
 * that act at a smaller scale rather than a lesser one.
 *
 * The button stays disabled until the name matches exactly. Whitespace is forgiven because it is a
 * paste artefact; case is not, because that is the difference between reading and skimming.
 */
export function DeletePatientDialog({
  patientId,
  patientName,
  onDelete,
}: DeletePatientDialogProps) {
  const t = useTranslations('patient');
  const tCommon = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [isPending, setIsPending] = useState(false);

  const matches = confirmation.trim() === patientName.trim();

  /* Cleared on close so reopening never starts with a name already typed in. */
  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) setConfirmation('');
  }

  async function handleDelete() {
    if (!matches) return;
    setIsPending(true);
    try {
      await onDelete(patientId, confirmation.trim());
      handleOpenChange(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-destructive">
          <Trash2 className="size-4" aria-hidden />
          {t('delete')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            {t('deleteTitle')}
          </DialogTitle>
          <DialogDescription>{t('deleteWarning')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Label htmlFor="delete-patient-confirmation" className="text-sm">
            {t('deleteConfirmLabel', { name: patientName })}
          </Label>
          <Input
            id="delete-patient-confirmation"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            placeholder={patientName}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!matches || isPending}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" aria-hidden />
            {isPending ? tCommon('loading') : t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
