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
export async function resolveGuideService(
  clinicId: string,
  manipulationType: string,
  locale: AppLocale
): Promise<ServiceResult<RecoveryGuideView>> {
  const own = await recoveryGuideRepository.findForClinic(clinicId, manipulationType, locale);
  if (own && own.isPublished) return { data: toView(own, false), status: 200 };

  const fallback = await recoveryGuideRepository.findDefault(manipulationType, locale);
  if (fallback) return { data: toView(fallback, true), status: 200 };

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
