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
import { confirmationMatches } from '@/shared/utils/confirmation-name';

/** Failures worth naming on screen; anything else falls back to GENERIC. */
type DeletePatientError = 'CONFIRMATION_MISMATCH' | 'GENERIC';

const KNOWN_ERRORS: DeletePatientError[] = ['CONFIRMATION_MISMATCH'];

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
 * The button stays disabled until the name matches. Whitespace is forgiven — leading, trailing and
 * doubled alike, because a run of spaces inside a stored name renders as one and cannot be typed
 * back; case is not, because that is the difference between reading and skimming.
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
  const [error, setError] = useState<DeletePatientError | null>(null);

  const matches = confirmationMatches(confirmation, patientName);

  /* Cleared on close so reopening never starts with a name already typed in, or a stale failure. */
  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      setConfirmation('');
      setError(null);
    }
  }

  /*
    The catch is not defensive padding. Without it a refused delete rejected into nothing — no
    toast, no message, the dialog open and the row still there — which is indistinguishable from a
    button that does not work, and is exactly how this failure was reported.
  */
  async function handleDelete() {
    if (!matches) return;
    setIsPending(true);
    setError(null);
    try {
      await onDelete(patientId, confirmation);
      handleOpenChange(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(
        KNOWN_ERRORS.includes(message as DeletePatientError)
          ? (message as DeletePatientError)
          : 'GENERIC'
      );
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

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {t(`deleteError.${error}`)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
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
