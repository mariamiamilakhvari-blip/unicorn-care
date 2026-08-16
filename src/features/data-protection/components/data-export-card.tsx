'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { DATA_EXPORT_PATH } from '@/shared/const/data-request.const';

/**
 * The access and portability right, as one button.
 *
 * A plain link rather than a fetch-and-blob. The endpoint already answers with
 * `Content-Disposition: attachment`, so the browser saves the file itself — and doing it this way
 * means the download survives everything a JavaScript implementation would not: a slow connection,
 * a backgrounded tab, a patient who taps and locks their phone.
 *
 * `download` is set anyway so the filename is preserved on the browsers that would otherwise
 * navigate, and the link is not `target="_blank"`: a JSON attachment opens nothing, and a blank
 * tab left behind on a phone is just something else to close.
 */
export function DataExportCard() {
  const t = useTranslations('privacy');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('exportHeading')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('exportHelp')}</p>
        <Button asChild variant="outline" className="self-start">
          <a href={DATA_EXPORT_PATH} download>
            <Download className="size-4" aria-hidden />
            {t('exportDownload')}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
