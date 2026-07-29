/**
 * One page per keyword cluster.
 *
 * A single landing page cannot rank for eighteen distinct phrases — search engines rank pages, not
 * sites, and a page that tries to cover everything ranks well for nothing. Each entry here owns one
 * cluster ("medication reminder software", "patient portal") with its own URL, title, H1 and body,
 * and the home page links to all of them. That internal linking is what passes authority down and
 * what makes the cluster discoverable in the first place.
 *
 * Content is deliberately specific to this product. Thin pages spun up per keyword are the pattern
 * Google's helpful-content system demotes; these describe features that genuinely exist.
 */

import { PATIENT_FOLLOW_UP_PAGE } from '@/shared/const/feature-page-follow-up.const';
import { MEDICATION_REMINDERS_PAGE } from '@/shared/const/feature-page-medication.const';
import { PATIENT_PORTAL_PAGE } from '@/shared/const/feature-page-portal.const';
import { SURGERY_RECOVERY_PAGE } from '@/shared/const/feature-page-recovery.const';
import { FeaturePage } from '@/shared/const/feature-page.types';

export type { FeaturePage, FeaturePageContent } from '@/shared/const/feature-page.types';

export const FEATURE_PAGES: FeaturePage[] = [
  MEDICATION_REMINDERS_PAGE,
  PATIENT_PORTAL_PAGE,
  SURGERY_RECOVERY_PAGE,
  PATIENT_FOLLOW_UP_PAGE,
];

export function findFeaturePage(slug: string): FeaturePage | undefined {
  return FEATURE_PAGES.find(page => page.slug === slug);
}
