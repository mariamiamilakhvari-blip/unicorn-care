import { RecoveryGuideForOccurrences } from '@/features/care-plan/service/guide-occurrence.service';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { resolveGuideList } from '@/features/recovery-guide/service/guide-resolution.service';
import { AppLocale } from '@/shared/types/roles';

/**
 * The guide whose expected signs become day-based reminders for a plan.
 *
 * Guides are keyed on the *procedure's* manipulation type, so the procedure is read to find one.
 *
 * The clinic's own expected signs win, and the platform's are the fallback for a clinic that wrote
 * none — the same per-list rule the portal panel resolves by, so the reminders a patient receives
 * are generated from the very list they can read on screen. Resolving these two independently is
 * how a patient ended up with platform reminders sitting beside their clinic's own guidance.
 *
 * `null` is a normal answer, not an error: a clinic that has not written a guide for this procedure
 * type simply gets no expected-sign reminders. Activation must never fail over missing reference
 * content — a patient losing their medication schedule because nobody wrote a guide would be far
 * worse than a patient not getting the guide notices.
 */
export async function resolveGuideForProcedure(
  procedureId: string,
  clinicId: string,
  locale: AppLocale
): Promise<RecoveryGuideForOccurrences | null> {
  const procedure = await procedureRepository.findById(procedureId, clinicId);
  if (!procedure) return null;

  const own = await recoveryGuideRepository.findForClinic(
    clinicId,
    procedure.manipulationType,
    locale
  );
  const fallback = await recoveryGuideRepository.findDefault(procedure.manipulationType, locale);

  /*
    Unpublished content generates nothing, on either side. A draft is text nobody qualified has
    signed off, and a reminder is the one part of a guide that arrives unasked — so an unpublished
    row is treated as absent here rather than as a lower-priority source.
  */
  const published = own?.isPublished ? own : null;
  const publishedFallback = fallback?.isPublished ? fallback : null;

  const expected = resolveGuideList(published?.expected, publishedFallback?.expected);
  if (expected.length === 0) return null;

  return { expected };
}
