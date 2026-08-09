import ResetPasswordPage, {
  metadata as resetPasswordMetadata,
  type ResetPasswordPageProps,
} from '@/app/(public)/reset-password/page';

export const metadata = resetPasswordMetadata;

export default function EnglishResetPasswordPage(props: ResetPasswordPageProps) {
  return <ResetPasswordPage {...props} />;
}
