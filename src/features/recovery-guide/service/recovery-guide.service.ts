import { Types } from 'mongoose';

import { recoveryGuideRepository } from '@/features/recovery-guide/repository/recovery-guide.repository';
import { RecoveryGuideDocument } from '@/features/recovery-guide/schema/recovery-guide.schema';
import { RecoveryGuideView } from '@/features/recovery-guide/types/recovery-guide.types';
import { UpsertRecoveryGuideType } from '@/features/recovery-guide/validations/recovery-guide.validation';
import { ServiceResult } from '@/shared/types/common';
import { AppLocale } from '@/shared/types/roles';

function toView(guide: RecoveryGuideDocument, isDefault: boolean): RecoveryGuideView {
  return {
    id: guide._id.toString(),
    manipulationType: guide.manipulationType,
    locale: guide.locale,
    expected: (guide.expected ?? []).map(item => ({
      title: item.title,
      description: item.description ?? '',
      fromDay: item.fromDay,
      toDay: item.toDay,
    })),
    warning: (guide.warning ?? []).map(item => ({
      title: item.title,
      description: item.description ?? '',
      severity: item.severity,
      fromDay: item.fromDay ?? 0,
      toDay: item.toDay ?? 0,
    })),
    isPublished: guide.isPublished,
    isDefault,
  };
}

export async function listGuidesService(
  clinicId: string
): Promise<ServiceResult<{ items: RecoveryGuideView[] }>> {
  const guides = await recoveryGuideRepository.findAllByClinic(clinicId);
  return { data: { items: guides.map(guide => toView(guide, false)) }, status: 200 };
}

/**
 * Creates or replaces this clinic's guide for a procedure type and language.
 *
 * A clinic's own guide always overrides the platform default; the default is never mutated, so a
 * clinic editing its copy cannot change what other clinics show their patients.
 */
/** `{ durationDays: 21 }` becomes `{ fromDay: 0, toDay: 21 }` — the shape the document holds. */
function toStoredWindow<T extends { durationDays: number }>(
  item: T
): Omit<T, 'durationDays'> & { fromDay: number; toDay: number } {
  const { durationDays, ...rest } = item;
  return { ...rest, fromDay: 0, toDay: durationDays };
}

export async function upsertGuideService(
  clinicId: string,
  userId: string,
  input: UpsertRecoveryGuideType
): Promise<ServiceResult<RecoveryGuideView>> {
  const existing = await recoveryGuideRepository.findForClinic(
    clinicId,
    input.manipulationType,
    input.locale
  );

  const payload = {
    ...input,
    /*
      The editor collects one number per item; the document keeps the pair it always had. Every
      patient-side reader works in windows — the daily email asks whether today falls inside one,
      the portal prints the range, and an expected sign's reminder fires on its start day — so
      collapsing the storage would have meant rewriting all of them to answer a question they do
      not ask. A duration is the window starting on the day of the operation.
    */
    expected: input.expected.map(toStoredWindow),
    warning: input.warning.map(toStoredWindow),
    clinicId: new Types.ObjectId(clinicId),
    updatedByUserId: new Types.ObjectId(userId),
  };

  if (existing) {
    await recoveryGuideRepository.updateById(existing._id.toString(), clinicId, payload);
    const updated = await recoveryGuideRepository.findById(existing._id.toString(), clinicId);
    if (!updated) return { data: { error: 'NOT_FOUND' }, status: 404 };
    return { data: toView(updated, false), status: 200 };
  }

  const id = await recoveryGuideRepository.create(payload);
  const created = await recoveryGuideRepository.findById(id, clinicId);
  if (!created) return { data: { error: 'NOT_FOUND' }, status: 404 };

  return { data: toView(created, false), status: 201 };
}

/**
 * Resolves the guide a patient should read: the clinic's own if it exists and is published,
 * otherwise the platform default. Returns 404 when neither exists — the portal then shows nothing
 * rather than inventing reassurance.
 */
/**
 * The guide for one procedure type in one language.
 *
 * Two lookups, and only two: this clinic's own guide, then the platform default. Both in the
 * language that was asked for.
 *
 * It never crosses languages. A patient who has chosen English is shown English or nothing —
 * guidance in a language they did not choose is not guidance they can act on, and content they
 * cannot read sitting under a "when to contact the clinic" heading is worse than an honest empty
 * state, which is what the portal renders instead. The same rule keeps the clinic's own editor
 * honest: the care plan builder resolves through here too, and a cross-language fallback would
 * load Georgian text into an English form and invite someone to save it as a translation.
 *
 * The two ways of having nothing are reported apart. `NOT_FOUND` means no guide exists for this
 * procedure in any language; `NOT_TRANSLATED` means one does, in the language the reader did not
 * pick. The portal says which, because "your clinic has not written this yet" is a false
 * statement to show someone whose clinic wrote it in Georgian last week.
 *
 * It does not translate either, for the reason that outlives any fallback rule: this is
 * clinic-authored clinical reference material read unsupervised by a post-operative patient, and
 * a machine translation of "call the clinic if your temperature exceeds 38" that lands on the
 * wrong number or the wrong verb is a safety failure rather than a rough edge.
 */
export async function resolveGuideService(
  clinicId: string,
  manipulationType: string,
  locale: AppLocale
): Promise<ServiceResult<RecoveryGuideView>> {
  const own = await recoveryGuideRepository.findForClinic(clinicId, manipulationType, locale);
  if (own && own.isPublished) return { data: toView(own, false), status: 200 };

  const fallback = await recoveryGuideRepository.findDefault(manipulationType, locale);
  if (fallback) return { data: toView(fallback, true), status: 200 };

  /*
    Nothing to serve — but "nobody has written this" and "it exists, just not in your language"
    are different facts, and telling a patient the first when the second is true is simply wrong.
    So the other language is checked to find out *which* it is.

    This looks past the requested language and still never serves what it finds: the lookup
    decides a message, never a payload. The rule that a reader sees their own language or nothing
    is unchanged.
  */
  const otherLocale: AppLocale = locale === 'ka' ? 'en' : 'ka';
  const ownOther = await recoveryGuideRepository.findForClinic(
    clinicId,
    manipulationType,
    otherLocale
  );
  if (ownOther?.isPublished) return { data: { error: 'NOT_TRANSLATED' }, status: 404 };

  const defaultOther = await recoveryGuideRepository.findDefault(manipulationType, otherLocale);
  if (defaultOther) return { data: { error: 'NOT_TRANSLATED' }, status: 404 };

  return { data: { error: 'NOT_FOUND' }, status: 404 };
}

export async function deleteGuideService(
  clinicId: string,
  id: string
): Promise<ServiceResult<{ deleted: boolean }>> {
  const deleted = await recoveryGuideRepository.deleteById(id, clinicId);
  if (!deleted) return { data: { error: 'NOT_FOUND' }, status: 404 };
  return { data: { deleted }, status: 200 };
}
