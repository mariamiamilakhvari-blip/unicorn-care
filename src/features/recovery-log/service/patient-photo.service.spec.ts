import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/recovery-log/repository/patient-photo.repository', () => ({
  patientPhotoRepository: { findById: vi.fn(), deleteById: vi.fn() },
}));
vi.mock('@/features/recovery-log/repository/recovery-log.repository', () => ({
  recoveryLogRepository: { pullPhoto: vi.fn() },
}));
vi.mock('@/features/recovery-log/repository/photo-access-event.repository', () => ({
  photoAccessEventRepository: { create: vi.fn(), findByPhoto: vi.fn() },
}));
vi.mock('@/shared/lib/blob-client', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/blob-client')>(
    '@/shared/lib/blob-client'
  );
  return { ...actual, blobClient: { readPrivate: vi.fn(), deletePrivate: vi.fn() } };
});

import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { photoAccessEventRepository } from '@/features/recovery-log/repository/photo-access-event.repository';
import { recoveryLogRepository } from '@/features/recovery-log/repository/recovery-log.repository';
import { PatientPhotoDocument } from '@/features/recovery-log/schema/patient-photo.schema';
import {
  deletePatientPhotoService,
  listPhotoAccessService,
  PhotoViewer,
  streamPatientPhotoService,
} from '@/features/recovery-log/service/patient-photo.service';
import { blobClient, PRIVATE_BLOB_PREFIX } from '@/shared/lib/blob-client';
import { clock } from '@/shared/lib/clock';

const photos = vi.mocked(patientPhotoRepository);
const events = vi.mocked(photoAccessEventRepository);
const blob = vi.mocked(blobClient);
const logs = vi.mocked(recoveryLogRepository);

const PHOTO = '507f1f77bcf86cd799439011';
const PATIENT = '507f1f77bcf86cd799439022';
const CLINIC = '507f1f77bcf86cd799439033';
const USER = '507f1f77bcf86cd799439044';
const OTHER = '507f1f77bcf86cd7994390aa';

const NOW = new Date('2026-08-09T12:00:00.000Z');

const photo = (over: Partial<PatientPhotoDocument> = {}): PatientPhotoDocument =>
  ({
    _id: new mongoose.Types.ObjectId(PHOTO),
    patientId: new mongoose.Types.ObjectId(PATIENT),
    clinicId: new mongoose.Types.ObjectId(CLINIC),
    pathname: `${PRIVATE_BLOB_PREFIX}${CLINIC}/${PATIENT}/day7.jpg`,
    contentType: 'image/jpeg',
    size: 2048,
    ...over,
  }) as PatientPhotoDocument;

const clinicViewer: PhotoViewer = { type: 'clinic_user', userId: USER, clinicId: CLINIC };
const patientViewer: PhotoViewer = { type: 'patient', patientId: PATIENT, clinicId: CLINIC };

const logged = () => events.create.mock.calls.map(call => call[0]);

describe('streamPatientPhotoService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    events.create.mockResolvedValue('event-id');
    blob.readPrivate.mockResolvedValue({
      ok: true,
      stream: new ReadableStream<Uint8Array>(),
      contentType: 'image/jpeg',
      size: 2048,
    });
  });

  describe('who may read', () => {
    it('serves a clinic user their own clinic’s photograph', async () => {
      photos.findById.mockResolvedValue(photo());

      const result = await streamPatientPhotoService(PHOTO, clinicViewer);

      expect(result.ok).toBe(true);
    });

    it('serves a patient their own photograph', async () => {
      photos.findById.mockResolvedValue(photo());

      expect((await streamPatientPhotoService(PHOTO, patientViewer)).ok).toBe(true);
    });

    it('refuses a clinic user reaching into another clinic', async () => {
      photos.findById.mockResolvedValue(photo());

      const result = await streamPatientPhotoService(PHOTO, { ...clinicViewer, clinicId: OTHER });

      expect(result).toMatchObject({ ok: false, reason: 'WRONG_CLINIC' });
      expect(blob.readPrivate).not.toHaveBeenCalled();
    });

    /** Same clinic, different patient — a magic-link holder guessing at ids. */
    it('refuses a patient another patient’s photograph', async () => {
      photos.findById.mockResolvedValue(photo());

      const result = await streamPatientPhotoService(PHOTO, {
        ...patientViewer,
        patientId: OTHER,
      });

      expect(result).toMatchObject({ ok: false, reason: 'NOT_YOUR_PHOTO' });
      expect(blob.readPrivate).not.toHaveBeenCalled();
    });

    /**
     * A 403 would confirm the photograph exists, which tells someone probing ids that they have
     * found a real patient record. That is the one fact worth withholding here.
     */
    it('answers a refusal with 404, indistinguishable from one that does not exist', async () => {
      photos.findById.mockResolvedValue(photo());
      const refused = await streamPatientPhotoService(PHOTO, { ...clinicViewer, clinicId: OTHER });

      photos.findById.mockResolvedValue(null);
      const missing = await streamPatientPhotoService(PHOTO, clinicViewer);

      expect(refused.ok === false && refused.status).toBe(404);
      expect(missing.ok === false && missing.status).toBe(404);
    });
  });

  /**
   * The reason the bytes are proxied rather than handed out as a presigned URL. A bearer URL can
   * be used, forwarded and re-used with nothing here ever hearing about it.
   */
  describe('every attempt is written down', () => {
    it('logs a served read with the viewer', async () => {
      photos.findById.mockResolvedValue(photo());

      await streamPatientPhotoService(PHOTO, clinicViewer);

      expect(logged()[0]).toMatchObject({
        outcome: 'served',
        viewerType: 'clinic_user',
        reason: '',
        viewedAt: NOW,
      });
      expect(logged()[0].viewerUserId?.toString()).toBe(USER);
    });

    it('logs a patient read with no user id, because a patient has no account', async () => {
      photos.findById.mockResolvedValue(photo());

      await streamPatientPhotoService(PHOTO, patientViewer);

      expect(logged()[0]).toMatchObject({ viewerType: 'patient', viewerUserId: null });
    });

    /** A log of successes alone would miss exactly the event worth having a record of. */
    it('logs a refusal, with the reason', async () => {
      photos.findById.mockResolvedValue(photo());

      await streamPatientPhotoService(PHOTO, { ...clinicViewer, clinicId: OTHER });

      expect(logged()[0]).toMatchObject({ outcome: 'denied', reason: 'WRONG_CLINIC' });
    });

    it('logs an attempt on a photograph that does not exist', async () => {
      photos.findById.mockResolvedValue(null);

      await streamPatientPhotoService(PHOTO, clinicViewer);

      expect(logged()[0]).toMatchObject({ outcome: 'denied', reason: 'NOT_FOUND' });
    });

    it('writes the log before the bytes are handed back', async () => {
      photos.findById.mockResolvedValue(photo());

      await streamPatientPhotoService(PHOTO, clinicViewer);

      // A read whose log write failed would be an access nobody can account for.
      expect(events.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('storage faults', () => {
    it('reports a failed blob read as 502 and logs it', async () => {
      photos.findById.mockResolvedValue(photo());
      blob.readPrivate.mockResolvedValue({ ok: false, message: 'BLOB_NOT_FOUND' });

      const result = await streamPatientPhotoService(PHOTO, clinicViewer);

      expect(result).toMatchObject({ ok: false, status: 502, reason: 'BLOB_NOT_FOUND' });
      expect(logged()[0]).toMatchObject({ outcome: 'denied', reason: 'BLOB_NOT_FOUND' });
    });

    /**
     * The pathname came from our own row, so a public one means a patient photograph has been put
     * in the public half of the store. Serving it through here would hide that rather than
     * surface it.
     */
    it('refuses a row whose pathname is not private', async () => {
      photos.findById.mockResolvedValue(photo({ pathname: 'marketing/hero.png' }));

      const result = await streamPatientPhotoService(PHOTO, clinicViewer);

      expect(result).toMatchObject({ ok: false, reason: 'NOT_A_PRIVATE_PATH', status: 403 });
      expect(blob.readPrivate).not.toHaveBeenCalled();
    });
  });

  it('serves the stored content type rather than the provider’s', async () => {
    // The stored one is what was checked at upload time.
    photos.findById.mockResolvedValue(photo({ contentType: 'image/png' }));

    const result = await streamPatientPhotoService(PHOTO, clinicViewer);

    expect(result.ok && result.contentType).toBe('image/png');
  });
});

describe('listPhotoAccessService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    events.findByPhoto.mockResolvedValue([]);
  });

  it('gives a clinic the audit trail for its own photograph', async () => {
    photos.findById.mockResolvedValue(photo());

    expect(await listPhotoAccessService(PHOTO, CLINIC)).toEqual([]);
  });

  it('gives another clinic nothing', async () => {
    photos.findById.mockResolvedValue(photo());

    expect(await listPhotoAccessService(PHOTO, OTHER)).toBeNull();
    expect(events.findByPhoto).not.toHaveBeenCalled();
  });
});

/**
 * The consent wording a patient agreed to at upload, and the DPA, both say a photograph can be
 * removed on request. Before this existed neither promise had an implementation behind it, which
 * is worse than not having made it.
 */
describe('deletePatientPhotoService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(clock, 'now').mockReturnValue(NOW);
    events.create.mockResolvedValue('event-id');
    photos.findById.mockResolvedValue(photo());
    photos.deleteById.mockResolvedValue(true);
    logs.pullPhoto.mockResolvedValue(1);
    blob.deletePrivate.mockResolvedValue(true);
  });

  it('deletes the bytes, the row and the references', async () => {
    const result = await deletePatientPhotoService(PHOTO, patientViewer);

    expect(result.ok).toBe(true);
    expect(blob.deletePrivate).toHaveBeenCalledWith(photo().pathname);
    expect(photos.deleteById).toHaveBeenCalledWith(PHOTO);
    expect(logs.pullPhoto).toHaveBeenCalled();
  });

  /**
   * The inverse of the upload order, deliberately. Bytes gone with a row left behind is a visible
   * inconsistency that still honours the request; a row gone while the bytes survive is a
   * photograph of somebody's body left in storage with nothing pointing at it.
   */
  it('removes the bytes before the row', async () => {
    await deletePatientPhotoService(PHOTO, patientViewer);

    expect(blob.deletePrivate.mock.invocationCallOrder[0]).toBeLessThan(
      photos.deleteById.mock.invocationCallOrder[0]
    );
  });

  it('keeps the row when the bytes could not be removed', async () => {
    blob.deletePrivate.mockResolvedValue(false);

    const result = await deletePatientPhotoService(PHOTO, patientViewer);

    expect(result).toMatchObject({ ok: false, reason: 'BLOB_DELETE_FAILED', status: 502 });
    // Otherwise the bytes become unreachable and undeletable, and we reported success.
    expect(photos.deleteById).not.toHaveBeenCalled();
    expect(logs.pullPhoto).not.toHaveBeenCalled();
  });

  it('detaches the photograph from the log entry that referenced it', async () => {
    // A dangling id renders as a broken image where a patient believes it was removed.
    await deletePatientPhotoService(PHOTO, patientViewer);

    expect(logs.pullPhoto.mock.calls[0][0].toString()).toBe(PHOTO);
  });

  describe('who may delete', () => {
    it('lets the clinic delete, which is the path the consent wording describes', async () => {
      expect((await deletePatientPhotoService(PHOTO, clinicViewer)).ok).toBe(true);
    });

    it('refuses another clinic', async () => {
      const result = await deletePatientPhotoService(PHOTO, { ...clinicViewer, clinicId: OTHER });

      expect(result).toMatchObject({ ok: false, reason: 'WRONG_CLINIC', status: 404 });
      expect(blob.deletePrivate).not.toHaveBeenCalled();
    });

    it('refuses another patient', async () => {
      const result = await deletePatientPhotoService(PHOTO, {
        ...patientViewer,
        patientId: OTHER,
      });

      expect(result).toMatchObject({ ok: false, reason: 'NOT_YOUR_PHOTO', status: 404 });
      expect(blob.deletePrivate).not.toHaveBeenCalled();
    });

    it('answers 404 for a photograph that does not exist', async () => {
      photos.findById.mockResolvedValue(null);

      expect(await deletePatientPhotoService(PHOTO, patientViewer)).toMatchObject({ status: 404 });
    });
  });

  /**
   * Once the bytes and the row are gone this entry is the only remaining evidence the photograph
   * existed and that somebody removed it — which is what answers a patient asking whether their
   * request was carried out.
   */
  it('leaves a deletion record behind', async () => {
    await deletePatientPhotoService(PHOTO, patientViewer);

    expect(logged()[0]).toMatchObject({ outcome: 'deleted', viewerType: 'patient', reason: '' });
  });

  it('records a refused deletion too', async () => {
    await deletePatientPhotoService(PHOTO, { ...clinicViewer, clinicId: OTHER });

    expect(logged()[0]).toMatchObject({ outcome: 'denied', reason: 'WRONG_CLINIC' });
  });
});
