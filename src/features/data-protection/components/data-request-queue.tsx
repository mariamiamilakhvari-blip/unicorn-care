'use client';

import { ShieldAlert } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useDataRequests } from '@/features/data-protection/hooks/use-data-requests';
import { DataRequestView } from '@/features/data-protection/types/data-protection.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { DataRequestStatus } from '@/shared/const/data-request.const';

/**
 * The clinic's queue of patient correction and erasure requests.
 *
 * Renders nothing at all when the queue is empty, which is the normal state. A permanently visible
 * empty panel on the settings page would be one more thing to scroll past every day, and the whole
 * value of this card is that its presence means something needs doing.
 */
export function DataRequestQueue() {
  const t = useTranslations('dataRequests');
  const { requests, isLoading, hasError, pendingId, resolve } = useDataRequests();

  if (isLoading || hasError || requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4 text-primary" aria-hidden />
          {t('heading')}
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('help')}</p>
        <ul className="flex flex-col gap-4">
          {requests.map(request => (
            <RequestRow
              key={request.id}
              request={request}
              isBusy={pendingId === request.id}
              onResolve={(status, resolution) => void resolve(request.id, status, resolution)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

type RequestRowProps = {
  request: DataRequestView;
  isBusy: boolean;
  onResolve: (status: DataRequestStatus, resolution: string) => void;
};

/**
 * One request, with the answer written before either button is available.
 *
 * Both actions require the text. A refusal without a stated basis is not a lawful response to a
 * data subject request, and a completion without one leaves the patient unable to tell what was
 * changed on their record — so the buttons stay disabled rather than the form accepting an empty
 * answer and the rule being enforced only server-side.
 */
function RequestRow({ request, isBusy, onResolve }: RequestRowProps) {
  const t = useTranslations('dataRequests');
  const format = useFormatter();
  const [resolution, setResolution] = useState('');

  const canAnswer = resolution.trim().length > 0 && !isBusy;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{t(`kind_${request.kind}`)}</p>
        <p className="text-xs text-muted-foreground">
          {format.dateTime(new Date(request.requestedAt), { dateStyle: 'medium' })}
        </p>
      </div>

      {request.detail && (
        <p className="text-sm leading-relaxed text-muted-foreground">{request.detail}</p>
      )}

      {/*
        Named for erasure specifically. A clinic pressing "complete" on one is authorising a write
        that clears the patient's contact details, and the statutory retention on the clinical log
        is the part nobody expects — so it is said here rather than in a document.
      */}
      {request.kind === 'erasure' && (
        <p className="rounded-md border border-primary-edge bg-moss/10 p-3 text-xs leading-relaxed">
          {t('erasureNote')}
        </p>
      )}

      <Textarea
        rows={3}
        value={resolution}
        onChange={event => setResolution(event.target.value)}
        placeholder={t('resolutionHint')}
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!canAnswer} onClick={() => onResolve('completed', resolution)}>
          {t('markCompleted')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canAnswer}
          onClick={() => onResolve('refused', resolution)}
        >
          {t('markRefused')}
        </Button>
      </div>
    </li>
  );
}
