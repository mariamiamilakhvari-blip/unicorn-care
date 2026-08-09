'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { UnreachablePatient } from '@/features/dashboard/types/dashboard.types';

/** Enough to act on without turning the dashboard into a list. The rest are a click away. */
const NAMES_SHOWN = 5;

/**
 * Patients whose reminders reach nobody, on the screen the clinic opens first.
 *
 * The notice on a patient's page and the prompt at plan activation both depend on somebody
 * already looking at that patient. These are precisely the patients nobody is looking at: a plan
 * running for weeks, every reminder generated and marked handled, adherence counting doses the
 * patient was never told about, and no symptom anywhere that anything is wrong.
 *
 * Each name links straight to the record, because the fix is one field on that page and a banner
 * that only states a number leaves the clinic to hunt for who it means.
 *
 * Renders nothing when everyone is reachable. A dashboard that always carries a warning strip
 * teaches people to look past it, and this one is worth reading on the day it appears.
 */
export function UnreachableBanner({ patients }: { patients: UnreachablePatient[] }) {
  const t = useTranslations('dashboard');

  if (patients.length === 0) return null;

  const shown = patients.slice(0, NAMES_SHOWN);
  const remaining = patients.length - shown.length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-destructive p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-semibold">
          {t('unreachableTitle', { count: patients.length })}
        </h2>
        <p className="text-sm text-muted-foreground">{t('unreachableHelp')}</p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {shown.map(patient => (
          <li key={patient.id}>
            <Link
              href={`/dashboard/patients/${patient.id}`}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="font-medium">{patient.name}</span>
              <span className="text-xs text-muted-foreground">
                {t(`unreachableReason.${patient.reason}`)}
              </span>
            </Link>
          </li>
        ))}
        {remaining > 0 && (
          <li className="flex items-center px-1 text-sm text-muted-foreground">
            {t('unreachableMore', { count: remaining })}
          </li>
        )}
      </ul>
    </section>
  );
}
