import DataProcessingAgreementPage, {
  generateMetadata as dpaMetadata,
} from '@/app/(public)/dpa/page';

export const generateMetadata = dpaMetadata;

export default function EnglishDataProcessingAgreementPage() {
  return <DataProcessingAgreementPage />;
}
