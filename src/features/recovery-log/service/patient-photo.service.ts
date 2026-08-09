import { Types } from 'mongoose';

import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { photoAccessEventRepository } from '@/features/recovery-log/repository/photo-access-event.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { PatientPhotoDocument } from '@/features/recovery-log/schema/patient-photo.schema';
import { blobClient, isPrivateBlobPath } from '@/shared/lib/blob-client';
import { clock } from '@/shared/lib/clock';

/** Who is asking. A patient has no user account, which is why `userId` is nullable. */
export type PhotoViewer =
  | { type: 'clinic_user'; userId: string; clinicId: string }
  | { type: 'patient'; patientId: string; clinicId: string };

export type PhotoStreamResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; contentType: string; size: number }
  | { ok: false; reason: string; status: 404 | 403 | 502 };

/**
 * Records the attempt, then gets out of the way.
 *
 * Never throws and is always awaited before the bytes go out. A read that succeeded but whose log
 * write failed would be an access nobody can account for, which is the failure mode this table
 * exists to prevent — so a logging fault fails the read rather than being swallowed.
 */
async function log(
  photo: PatientPhotoDocument | null,
  photoId: string,
  viewer: PhotoViewer,
  outcome: 'served' | 'denied' | 'deleted',
  reason: string
): Promise<void> {
  await photoAccessEventRepository.create({
    photoId: new Types.ObjectId(photoId),
    patientId: photo?.patientId ?? null,
    clinicId: photo?.clinicId ?? null,
    viewerType: viewer.type,
    viewerUserId: viewer.type === 'clinic_user' ? new Types.ObjectId(viewer.userId) : null,
    outcome,
    reason,
    viewedAt: clock.now(),
  });
}

/**
 * Is this viewer allowed these bytes?
 *
 * A clinic user needs the photo to belong to their clinic; a patient needs it to be their own.
 * Both are checked against the stored row rather than against anything the request carried — the
 * only thing a request supplies is an id, and an id is a guess anyone can make.
 */
function refusalReason(photo: PatientPhotoDocument, viewer: PhotoViewer): string {
  if (photo.clinicId.toString() !== viewer.clinicId) return 'WRONG_CLINIC';
  if (viewer.type === 'patient' && photo.patientId.toString() !== viewer.patientId) {
    return 'NOT_YOUR_PHOTO';
  }
  return '';
}

/**
 * Serves one private patient photograph, and writes down that it happened.
 *
 * This is why the design proxies the bytes instead of handing out a presigned URL. A presigned
 * URL is a bearer credential: once issued it can be used, forwarded and re-used without anything
 * here observing it, it keeps working after consent is withdrawn until it expires, and it cannot
 * be revoked. Streaming through a guarded route costs a few megabytes of transfer and buys an
 * authorisation check on every single read, an exact access log, and immediate revocation.
 *
 * Refusals are logged as well as successes. A clinic user reaching for another clinic's patient
 * is the event most worth having a record of, and a log of successes alone would not have it.
 */
export async function streamPatientPhotoService(
  photoId: string,
  viewer: PhotoViewer
): Promise<PhotoStreamResult> {
  const photo = await patientPhotoRepository.findById(photoId);

  if (!photo) {
    await log(null, photoId, viewer, 'denied', 'NOT_FOUND');
    return { ok: false, reason: 'NOT_FOUND', status: 404 };
  }

  const refused = refusalReason(photo, viewer);
  if (refused) {
    await log(photo, photoId, viewer, 'denied', refused);
    /*
      404, not 403. A 403 confirms the photograph exists, which tells someone probing ids that
      they have found a real patient record — the one fact worth withholding here.
    */
    return { ok: false, reason: refused, status: 404 };
  }

  /*
    Defence in depth. The pathname came from our own row, so it should already be private; if it
    somehow is not, that is a bug that has put a patient photograph in the public half of the
    store, and serving it through here would hide that rather than surface it.
  */
  if (!isPrivateBlobPath(photo.pathname)) {
    await log(photo, photoId, viewer, 'denied', 'NOT_A_PRIVATE_PATH');
    return { ok: false, reason: 'NOT_A_PRIVATE_PATH', status: 403 };
  }

  const blob = await blobClient.readPrivate(photo.pathname);
  if (!blob.ok) {
    await log(photo, photoId, viewer, 'denied', blob.message);
    return { ok: false, reason: blob.message, status: 502 };
  }

  await log(photo, photoId, viewer, 'served', '');

  return {
    ok: true,
    stream: blob.stream,
    // The stored type, not the provider's: it is what was checked at upload time.
    contentType: photo.contentType || blob.contentType,
    size: photo.size || blob.size,
  };
}

export type PhotoDeleteResult =
  | { ok: true }
  | { ok: false; reason: string; status: 404 | 502 };

/**
 * Deletes a photograph: the bytes, the row, and every reference to it.
 *
 * Both the consent wording the patient agreed to and the BAA say a photograph can be removed on
 * request. Until this existed, neither promise had an implementation behind it — which is worse
 * than not having made the promise.
 *
 * The order is the inverse of the upload's, and deliberately so. Upload writes bytes first
 * because a blob with no row is merely wasted storage. Deletion removes the *bytes* first,
 * because the failure modes are not symmetric: bytes gone with the row left behind is a visible,
 * fixable inconsistency that still honours the patient's request, whereas a row deleted while the
 * bytes survive is a photograph of somebody's body left in storage with nothing pointing at it,
 * no way to find it, and a promise silently broken.
 *
 * The access log keeps a `deleted` row. Once the bytes and the record are gone, that entry is the
 * only remaining evidence the photograph ever existed and that somebody removed it — which is
 * precisely what is needed to answer a patient who asks whether their request was carried out.
 */
export async function deletePatientPhotoService(
  photoId: string,
  viewer: PhotoViewer
): Promise<PhotoDeleteResult> {
  const photo = await patientPhotoRepository.findById(photoId);

  if (!photo) {
    await log(null, photoId, viewer, 'denied', 'NOT_FOUND');
    return { ok: false, reason: 'NOT_FOUND', status: 404 };
  }

  const refused = refusalReason(photo, viewer);
  if (refused) {
    await log(photo, photoId, viewer, 'denied', refused);
    // 404 for the same reason a refused read is: a 403 confirms the photograph exists.
    return { ok: false, reason: refused, status: 404 };
  }

  const removed = await blobClient.deletePrivate(photo.pathname);
  if (!removed) {
    /*
      Refused rather than pressed on. Dropping the row here would leave the bytes unreachable and
      undeletable, and would report success for a deletion that did not happen.
    */
    await log(photo, photoId, viewer, 'denied', 'BLOB_DELETE_FAILED');
    return { ok: false, reason: 'BLOB_DELETE_FAILED', status: 502 };
  }

  await recoveryLogRepository.pullPhoto(photo._id);
  await patientPhotoRepository.deleteById(photoId);
  await log(photo, photoId, viewer, 'deleted', '');

  return { ok: true };
}

/** The clinic's own audit trail for one photograph. */
export async function listPhotoAccessService(photoId: string, clinicId: string) {
  const photo = await patientPhotoRepository.findById(photoId);
  if (!photo || photo.clinicId.toString() !== clinicId) return null;

  return photoAccessEventRepository.findByPhoto(photoId, 100);
}
