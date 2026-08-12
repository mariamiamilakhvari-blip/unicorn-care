import { LinkIcon } from 'lucide-react';

import { PortalLinkRequestForm } from '@/features/patient/components/portal-link-request-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';

type LinkExpiredNoticeProps = {
  title: string;
  help: string;
};

export function LinkExpiredNotice({ title, help }: LinkExpiredNoticeProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="size-5 text-primary" aria-hidden />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{help}</p>
          <Separator />
          <PortalLinkRequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
