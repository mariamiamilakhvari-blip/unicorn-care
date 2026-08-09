import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/recovery-log/repository/patient-photo.repository', () => ({
  patientPhotoRepository: { findById: vi.fn() },
}));
vi.mock('@/features/recovery-log/repository/photo-access-event.repository', () => ({
  photoAccessEventRepository: { create: vi.fn(), findByPhoto: vi.fn() },
}));
vi.mock('@/shared/lib/blob-client', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/blob-client')>(
    '@/shared/lib/blob-client'
  );
  return { ...actual, blobClient: { readPrivate: vi.fn() } };
});

import { patientPhotoRepository } from '@/features/recovery-log/repository/patient-photo.repository';
import { photoAccessEventRepository } from '@/features/recovery-log/repository/photo-access-event.repository';
import { PatientPhotoDocument } from '@/features/recovery-log/schema/patient-photo.schema';
import {
  listPhotoAccessService,
  PhotoViewer,
  streamPatientPhotoService,
} from '@/features/recovery-log/service/patient-photo.service';
import { blobClient, PRIVATE_BLOB_PREFIX } from '@/shared/lib/blob-client';
import { clock } from '@/shared/lib/clock';

const photos = vi.mocked(patientPhotoRepository);
const events = vi.mocked(photoAccessEventRepository);
const blob = vi.mocked(blobClient);

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
