'use client';

import { AlertTriangle, Send, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAssistant } from '@/features/assistant/hooks/use-assistant';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { ASSISTANT_MAX_QUESTION_LENGTH } from '@/shared/const/assistant.const';
import { cn } from '@/shared/lib/utils';

export function AssistantPanel() {
  const t = useTranslations('assistant');
  const tCommon = useTranslations('common');
  const { turns, isPending, error, ask } = useAssistant();
  const [question, setQuestion] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isPending) return;
    setQuestion('');
    await ask(trimmed);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {t('title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Standing, always-visible limit — not a one-time dismissible notice. */}
        <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('disclaimer')}
        </p>

        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {turns.map((turn, index) => (
              <li
                key={index}
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  turn.role === 'user'
                    ? 'self-end bg-primary text-primary-foreground'
                    : 'self-start bg-muted'
                )}
              >
                {turn.content}
              </li>
            ))}
          </ul>
        )}

        {isPending && <p className="text-sm text-muted-foreground">{t('thinking')}</p>}
        {error && <p className="text-sm font-medium text-destructive">{tCommon('error')}</p>}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={question}
            maxLength={ASSISTANT_MAX_QUESTION_LENGTH}
            onChange={event => setQuestion(event.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
          />
          <Button type="submit" disabled={isPending || question.trim().length === 0}>
            <Send className="size-4" aria-hidden />
            <span className="sr-only">{t('send')}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
