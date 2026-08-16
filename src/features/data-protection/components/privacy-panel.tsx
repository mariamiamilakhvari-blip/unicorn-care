'use client';

import { useTranslations } from 'next-intl';

import { ConsentControls } from '@/features/data-protection/components/consent-controls';
import { DataExportCard } from '@/features/data-protection/components/data-export-card';
import { DataRequestForm } from '@/features/data-protection/components/data-request-form';
import { usePrivacySettings } from '@/features/data-protection/hooks/use-privacy-settings';
import { Button } from '@/shared/components/ui/button';

/**
 * The portal's privacy screen: what is consented to, how to get a copy, how to ask for a change.
 *
 * Ordered by how often it is needed rather than by how the statute is written. A patient opening
 * this page has almost always come to turn reminders off; the export and the request form are
 * rights they may exercise once, and putting either first would bury the thing they came for.
 */
export function PrivacyPanel() {
  const t = useTranslations('privacy');
  const tCommon = useTranslations('common');
  const { consents, requests, isLoading, hasError, pendingType, setConsent, fileRequest, reload } =
    usePrivacySettings();

  if (isLoading) return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;

  if (hasError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{tCommon('error')}</p>
        <Button variant="outline" onClick={() => void reload()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>
      <ConsentControls
        consents={consents}
        pendingType={pendingType}
        onChange={(type, granted) => void setConsent(type, granted)}
      />
      <DataExportCard />
      <DataRequestForm
        requests={requests}
        onSubmit={(kind, detail) => fileRequest(kind, detail)}
      />
    </div>
  );
}
