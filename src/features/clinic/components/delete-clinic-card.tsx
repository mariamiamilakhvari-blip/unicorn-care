'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useDeleteClinic } from '@/features/clinic/hooks/use-delete-clinic';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

/**
 * The danger zone. Deleting takes the subscription, every patient record and every staff login
 * with it, so the button stays disabled until the owner has typed the clinic's name exactly —
 * a confirm dialog alone is too easy to click through for something this final.
 */
export function DeleteClinicCard({ clinicName }: { clinicName: string }) {
  const t = useTranslations('clinic');
  const [confirmation, setConfirmation] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { deleteClinic, isPending, error } = useDeleteClinic();

  const matches = confirmation.trim() === clinicName.trim();

  return (
    <Card className="border-destructive/40">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" aria-hidden />
          {t('dangerZone')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('deleteAccountBlurb')}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          <li>• {t('deleteConsequence.subscription')}</li>
          <li>• {t('deleteConsequence.patients')}</li>
          <li>• {t('deleteConsequence.staff')}</li>
          <li>• {t('deleteConsequence.irreversible')}</li>
        </ul>

        {!isOpen ? (
          <Button
            type="button"
            variant="destructive"
            className="self-start"
            onClick={() => setIsOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            {t('deleteAccount')}
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
            <Label htmlFor="delete-confirmation" className="text-sm">
              {t('deleteConfirmLabel', { name: clinicName })}
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              placeholder={clinicName}
              autoComplete="off"
            />

            {error && <p className="text-sm font-medium text-destructive">{t(`deleteError.${error}`)}</p>}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={!matches || isPending}
                onClick={() => deleteClinic(confirmation)}
              >
                {isPending ? t('deleting') : t('deleteAccountConfirm')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setIsOpen(false);
                  setConfirmation('');
                }}
              >
                {t('cancelDelete')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
