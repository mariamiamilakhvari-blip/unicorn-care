import { LinkIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

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
        <CardContent>
          <p className="text-sm text-muted-foreground">{help}</p>
        </CardContent>
      </Card>
    </div>
  );
}
