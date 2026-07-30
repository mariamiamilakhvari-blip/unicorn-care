'use client';

import { Activity, Bell, Pill, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { HOME_FEATURES, type HomeFeatureIcon } from '@/shared/const/home.const';
import { cn } from '@/shared/lib/utils';

const FEATURE_ICON_MAP: Record<HomeFeatureIcon, LucideIcon> = {
  pill: Pill,
  bell: Bell,
  activity: Activity,
};

/**
 * The three product features as a scroll-driven deck: the stage pins to the viewport while the
 * reader scrolls past one full screen per feature, and each slide cross-fades in as its turn
 * arrives. It replaces the static three-up card grid rather than sitting beside it — the copy is
 * the same, and running both would say everything twice.
 *
 * Scroll position is never hijacked. The page scrolls at its normal rate; only which slide is
 * painted changes. A visitor who scrolls fast lands past the section as they would anywhere else,
 * and every slide stays in the DOM the whole time so search engines and screen readers get the
 * full text whether or not the observer ever fires.
 *
 * Layering: an absolutely positioned overlay carries the sticky stage, and the transparent step
 * blocks underneath it supply the scroll distance. That keeps every measurement on Tailwind's
 * standard scale (`inset-0`, `h-screen`) — no arbitrary viewport maths, per CLAUDE.md §0.
 */
export const FeatureDeck = () => {
  const t = useTranslations('marketing');
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const steps = stepRefs.current.filter((node): node is HTMLDivElement => node !== null);
    if (steps.length === 0) return;

    /*
      The negative margins collapse the root box to the viewport's centre line, so exactly one
      step is ever intersecting: the one the reader has scrolled to the middle of. Comparing
      intersection ratios instead would tie whenever two steps are equally visible.
    */
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.stepIndex);
          if (!Number.isNaN(index)) setActiveIndex(index);
        }
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
    );

    steps.forEach(step => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      aria-label={t('featuresEyebrow')}
      aria-roledescription="carousel"
      className="relative pb-24"
    >
      {/* The pinned stage. `inset-0` gives it the section's full height to stick within. */}
      <div className="absolute inset-0">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <div className="mx-auto w-full max-w-5xl px-6 sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('featuresEyebrow')}
            </p>

            {/*
              Slides are stacked in one grid cell rather than absolutely positioned, so the stage
              is always as tall as its tallest slide and nothing jumps as the copy changes length.
            */}
            <div className="mt-8 grid">
              {HOME_FEATURES.map((feature, index) => {
                const Icon = FEATURE_ICON_MAP[feature.icon];
                const isActive = index === activeIndex;

                return (
                  <article
                    key={feature.key}
                    aria-hidden={!isActive}
                    className={cn(
                      'col-start-1 row-start-1 transition-all duration-500 ease-out motion-reduce:transition-none',
                      isActive
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-4 opacity-0 motion-reduce:translate-y-0'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-6" />
                      </span>
                      <span className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                        {t(`features.${feature.key}.label`)}
                      </span>
                    </div>

                    <h2 className="mt-6 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">
                      {t(`features.${feature.key}.title`)}
                    </h2>

                    <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                      {t(`features.${feature.key}.description`)}
                    </p>
                  </article>
                );
              })}
            </div>

            {/* Progress rail: segmented meters in the brand colours, per the §19 signature. */}
            <ol className="mt-12 flex gap-2" aria-hidden="true">
              {HOME_FEATURES.map((feature, index) => (
                <li
                  key={feature.key}
                  className={cn(
                    'h-1 w-12 rounded-full transition-colors duration-500 motion-reduce:transition-none',
                    index === activeIndex ? 'bg-primary' : 'bg-border'
                  )}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/*
        Transparent scroll track. One screen per feature is what gives the reader time to take a
        slide in before the next replaces it; the blocks carry no content of their own.
      */}
      <div className="relative">
        {HOME_FEATURES.map((feature, index) => (
          <div
            key={feature.key}
            ref={node => {
              stepRefs.current[index] = node;
            }}
            data-step-index={index}
            aria-hidden="true"
            className="h-screen"
          />
        ))}
      </div>
    </section>
  );
};
