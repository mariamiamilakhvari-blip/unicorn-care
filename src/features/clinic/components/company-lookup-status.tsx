'use client';

import { useTranslations } from 'next-intl';

import { CompanyLookup } from '@/features/clinic/types/clinic.types';
import {
  COMPANY_LOOKUP_MESSAGE_KEYS,
  COMPANY_STATUS_MESSAGE_KEYS,
} from '@/shared/const/napr.const';

type CompanyLookupStatusProps = {
  /** Error code from the lookup endpoint, or null. */
  error: string | null;
  /** The entity the registry matched, or null. */
  company: CompanyLookup | null;
};

/**
 * What the registry said, under the tax ID field.
 *
 * Rendered whether the lookup found something or not, because both outcomes change what the clinic
 * should do next: a match confirms the fields that just filled themselves came from its own
 * registration and not a mistyped neighbour's, and a miss says to type them in rather than wait.
 *
 * `aria-live` so the answer to a lookup nobody clicked is announced — the request fires off a
 * debounce, so a screen reader user gets no other signal that anything happened.
 */
export function CompanyLookupStatus({ error, company }: CompanyLookupStatusProps) {
  const t = useTranslations('clinic');

  if (error) {
    const messageKey = COMPANY_LOOKUP_MESSAGE_KEYS[error];
    return (
      <p aria-live="polite" className="text-sm font-medium text-destructive">
        {messageKey ? t(messageKey) : t('companyNotFound')}
      </p>
    );
  }

  if (!company) return null;

  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      {/*
        The legal name is repeated here even though it has just been written into the name field.
        The point is not to state the name — it is to show which record the fields came from, and
        a clinic that has been given a company it does not recognise needs to see that side by side
        with the code it typed.
      */}
      <span className="font-medium text-foreground">{company.legalName}</span>
      {' · '}
      {t(COMPANY_STATUS_MESSAGE_KEYS[company.status])}
    </p>
  );
}
