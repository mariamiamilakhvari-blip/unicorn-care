/**
 * Every word that reaches an inbox, in both languages.
 *
 * The two locale tables live in their own files: together they run past the file-length limit, and
 * one locale per file is the convention the legal texts and the guide seeds already follow. This
 * file stays the only import anybody needs — the type is re-exported so no call site has to know
 * the copy was split.
 */
import { EMAIL_COPY_EN } from '@/shared/const/email-copy-en.const';
import { EMAIL_COPY_KA } from '@/shared/const/email-copy-ka.const';
import { EmailCopy } from '@/shared/const/email-copy.types';
import { AppLocale } from '@/shared/types/roles';

export type { EmailCopy };

export function emailCopy(locale: AppLocale): EmailCopy {
  return locale === 'en' ? EMAIL_COPY_EN : EMAIL_COPY_KA;
}
