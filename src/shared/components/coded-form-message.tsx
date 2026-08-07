'use client';

import { useTranslations } from 'next-intl';

import { useFormField } from '@/shared/components/ui/form';

type CodedFormMessageProps = {
  /** Message namespace holding the wording, e.g. `clinic`. */
  namespace: string;
  /** Error code → message key within that namespace. */
  keys: Record<string, string>;
};

/**
 * Renders a validation failure that arrives as a bare code.
 *
 * Schemas raise codes, not sentences — `INVALID_TAX_ID_GE`, `INVALID_EMAIL` — because the same
 * rule answers the API, where a translated string would be the wrong thing on the wire. That
 * leaves the translation to the form, and `FormMessage` cannot do it: it prefers `error.message`
 * over its children, so it would print the code.
 *
 * `formMessageId` is reused so the input's `aria-describedby` still resolves to whatever is shown.
 * A code with no mapping falls through unchanged rather than rendering blank — a length or type
 * error from Zod's own vocabulary is still more use to a clinic than nothing.
 */
export function CodedFormMessage({ namespace, keys }: CodedFormMessageProps) {
  const t = useTranslations(namespace);
  const { error, formMessageId } = useFormField();

  if (!error) return null;

  const code = String(error.message ?? '');
  const messageKey = keys[code];

  return (
    <p id={formMessageId} className="text-sm font-medium text-destructive">
      {messageKey ? t(messageKey) : code}
    </p>
  );
}
