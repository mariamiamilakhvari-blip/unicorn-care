import { RecoveryGuideForOccurrences } from '@/features/care-plan/service/guide-occurrence.service';
import { procedureRepository } from '@/features/procedure/repository/procedure.repository';
import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { AppLocale } from '@/shared/types/roles';

/**
 * The guide whose expected signs become day-based reminders for a plan.
 *
 * Guides are keyed on the *procedure's* manipulation type, so the procedure is read to find one. A
 * clinic's own guide wins; the platform default is the fallback.
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

  const guide =
    (await recoveryGuideRepository.findForClinic(clinicId, procedure.manipulationType, locale)) ??
    (await recoveryGuideRepository.findDefault(procedure.manipulationType, locale));

  if (!guide || !guide.isPublished) return null;

  return { expected: guide.expected };
}
