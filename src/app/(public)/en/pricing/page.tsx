import PricingPage, { generateMetadata as pricingMetadata } from '@/app/(public)/pricing/page';

export const generateMetadata = pricingMetadata;

export default function EnglishPricingPage() {
  return <PricingPage />;
}
