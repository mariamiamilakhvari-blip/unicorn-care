import { Types } from 'mongoose';

import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  PHOTO_CONSENT_VERSION,
} from '@/shared/const/recovery-log.const';
import { blobClient, PRIVATE_BLOB_PREFIX } from '@/shared/lib/blob-client';
import { clock } from '@/shared/lib/clock';
import { ServiceResult } from '@/shared/types/common';

export type UploadedPhotoView = { id: string; contentType: string; size: number };

/**
 * Where the bytes go: `patients/<clinicId>/<patientId>/<random>.<ext>`.
 *
 * The tenancy is in the path as well as in the row. The read path checks the database, and then
 * checks the prefix again — two independent statements of who this belongs to, so a bug in one
 * does not silently serve a photograph across clinics.
 */
function pathFor(clinicId: string, patientId: string, contentType: string): string {
  const extension = contentType.split('/')[1] ?? 'bin';
  return `${PRIVATE_BLOB_PREFIX}${clinicId}/${patientId}/${clock.now().getTime()}.${extension}`;
}

/**
 * Stores one post-operative photograph in the private blob store.
 *
 * Consent is a required argument rather than a field on the request, and it is recorded with the
 * version of the wording that was shown. Agreeing that the clinic may hold photographs is not
 * agreeing to *this* photograph, and a single account-level flag could not tell the two apart
 * afterwards — which is exactly the question that matters if a patient later asks what was kept
 * and what they agreed to.
 *
 * The type allowlist is not about file size or tidiness. `image/svg+xml` is a script the browser
 * will execute, and a photograph is never one; an allowlist means a format nobody considered is
 * refused rather than accepted by default.
 *
 * The row is written after the bytes, and that order is deliberate: a blob with no row costs
 * storage and is invisible, while a row with no blob is a broken thumbnail in a patient's own
 * recovery history. Given one has to be possible, it is the cheaper one.
 */
export async function uploadPatientPhotoService(
  patientId: string,
  clinicId: string,
  file: File
): Promise<ServiceResult<UploadedPhotoView>> {
  if (file.size === 0) return { data: { error: 'EMPTY_FILE' }, status: 400 };
  if (file.size > MAX_PHOTO_BYTES) return { data: { error: 'FILE_TOO_LARGE' }, status: 413 };

  const contentType = file.type;
  if (!ALLOWED_PHOTO_TYPES.some(allowed => allowed === contentType)) {
    return { data: { error: 'UNSUPPORTED_TYPE' }, status: 415 };
  }

  const stored = await blobClient.uploadPrivate(
    pathFor(clinicId, patientId, contentType),
    file
  );
  if (!stored.ok) return { data: { error: stored.message }, status: 502 };

  const now = clock.now();
  const id = await patientPhotoRepository.create({
    patientId: new Types.ObjectId(patientId),
    clinicId: new Types.ObjectId(clinicId),
    recoveryLogId: null,
    pathname: stored.pathname,
    contentType,
    size: file.size,
    consent: { version: PHOTO_CONSENT_VERSION, grantedAt: now },
    uploadedAt: now,
    uploadedBy: 'patient',
  });

  return { data: { id, contentType, size: file.size }, status: 201 };
}
