import { PhoneOff, ShieldCheck, Timer, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { HOME_BENEFITS, type HomeBenefitIcon } from '@/shared/const/home.const';
import { cn } from '@/shared/lib/utils';

const BENEFIT_ICON_MAP: Record<HomeBenefitIcon, LucideIcon> = {
  'phone-off': PhoneOff,
  'shield-check': ShieldCheck,
  timer: Timer,
};

/**
 * Written out rather than built from the index: the §19 stagger utilities are hand-authored CSS,
 * and a class name assembled at runtime is one rename away from silently animating nothing.
 */
const BENEFIT_STAGGER = ['animate-rise-1', 'animate-rise-2', 'animate-rise-3'] as const;

/**
 * The payoff, three cards wide, between the hero and the feature deck.
 *
 * A server component on purpose: the deck below it needs an observer and therefore the client, but
 * this is static text and the first thing a crawler reads after the headline. The heading of each
 * card is the claim; the line under it is what backs the claim up.
 */
export const BenefitCards = () => {
  const t = useTranslations('marketing');

  return (
    <section
      aria-label={t('benefitsEyebrow')}
      className="mx-auto w-full max-w-5xl px-6 pb-20 sm:px-10"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {HOME_BENEFITS.map((benefit, index) => {
          const Icon = BENEFIT_ICON_MAP[benefit.icon];

          return (
            <li
              key={benefit.key}
              className={cn(
                'animate-rise flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-6 transition-colors hover:border-primary/40',
                BENEFIT_STAGGER[index]
              )}
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>

              <h2 className="font-heading text-lg font-semibold leading-snug">
                {t(`benefits.${benefit.key}.title`)}
              </h2>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`benefits.${benefit.key}.description`)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
