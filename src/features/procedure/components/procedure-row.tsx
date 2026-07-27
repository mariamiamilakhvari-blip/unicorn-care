'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ProcedureView } from '@/features/procedure/types/procedure.types';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { PROCEDURE_TYPES } from '@/shared/const/procedure.const';
import { cn } from '@/shared/lib/utils';

type ProcedureRowProps = {
  procedure: ProcedureView;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
};

export function ProcedureRow({
  procedure,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: ProcedureRowProps) {
  const t = useTranslations('procedure');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const match = PROCEDURE_TYPES.find(type => type.key === procedure.manipulationType);
  const label = match ? (locale === 'ka' ? match.ka : match.en) : procedure.manipulationType;

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors',
        isSelected ? 'border-primary-edge bg-primary/15' : 'border-border'
      )}
    >
      {/* The row selects; the buttons sit outside it so a click never picks the wrong action. */}
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-sm text-muted-foreground">
          {procedure.performedAt.slice(0, 10)} · {procedure.operatorName}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
          {tCommon('edit')}
        </Button>

        <ConfirmDialog
          title={t('deleteTitle')}
          description={t('deleteWarning')}
          confirmLabel={tCommon('delete')}
          onConfirm={onDelete}
          trigger={
            <Button type="button" size="sm" variant="ghost" className="text-destructive">
              <Trash2 className="size-4" aria-hidden />
              {tCommon('delete')}
            </Button>
          }
        />
      </div>
    </li>
  );
}
