import { AppLocale } from '@/shared/types/roles';

/** Shape of one keyword-cluster page. Content lives in `feature-page-content.const.ts`. */
export type FeaturePageContent = {
  title: string;
  description: string;
  heading: string;
  lead: string;
  sections: { heading: string; body: string }[];
  ctaLabel: string;
};

export type FeaturePage = {
  slug: string;
  content: Record<AppLocale, FeaturePageContent>;
};
