import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/file/repository/file.repository', () => ({
  fileRepository: {
    findPage: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock('@/shared/lib/blob-client', () => ({
  blobClient: { upload: vi.fn(), remove: vi.fn() },
}));

import {
  deleteAdminFileService,
  MAX_FILE_BYTES,
  uploadAdminFileService,
} from '@/features/admin/service/admin-file.service';
import { fileRepository } from '@/features/file/repository/file.repository';
import { FileDocument } from '@/features/file/schema/file.schema';
import { blobClient } from '@/shared/lib/blob-client';

const repo = vi.mocked(fileRepository);
const blob = vi.mocked(blobClient);

const USER_ID = '507f1f77bcf86cd799439011';
const FILE_ID = '507f1f77bcf86cd799439022';

const stored = (): FileDocument =>
  ({
    _id: new mongoose.Types.ObjectId(FILE_ID),
    name: 'scan.png',
    pathname: 'scan-abc123.png',
    url: 'https://blob.example/scan-abc123.png',
    mimeType: 'image/png',
    size: 2048,
    uploadedByUserId: new mongoose.Types.ObjectId(USER_ID),
    createdAt: new Date('2026-08-08T00:00:00.000Z'),
    updatedAt: new Date('2026-08-08T00:00:00.000Z'),
  }) as FileDocument;

const upload = (name: string, type: string, size: number): File => {
  const file = new File(['x'], name, { type });
  // `size` is derived from the parts and read-only, so it is redefined to reach the bounds cheaply.
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('uploadAdminFileService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    blob.upload.mockResolvedValue({
      ok: true,
      url: 'https://blob.example/scan-abc123.png',
      pathname: 'scan-abc123.png',
    });
    repo.create.mockResolvedValue(FILE_ID);
    repo.findById.mockResolvedValue(stored());
  });

  it('stores the bytes, then the row that points at them', async () => {
    const result = await uploadAdminFileService(USER_ID, upload('scan.png', 'image/png', 2048));

    expect(result.status).toBe(201);
    expect(blob.upload).toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://blob.example/scan-abc123.png', size: 2048 })
    );
  });

  it('writes no row when the blob upload fails', async () => {
    // A row pointing at bytes that were never written is a broken entry with no way to clear it.
    blob.upload.mockResolvedValue({ ok: false, message: 'BLOB_NOT_CONFIGURED' });

    const result = await uploadAdminFileService(USER_ID, upload('scan.png', 'image/png', 2048));

    expect(result.status).toBe(502);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it.each([
    ['an SVG', 'image/svg+xml'],
    ['an HTML file', 'text/html'],
    ['an XHTML file', 'application/xhtml+xml'],
  ])('refuses %s, which executes script from the blob URL', async (_label, type) => {
    const result = await uploadAdminFileService(USER_ID, upload('payload', type, 512));

    expect(result.status).toBe(415);
    expect(blob.upload).not.toHaveBeenCalled();
  });

  it('refuses a file over the size ceiling', async () => {
    const result = await uploadAdminFileService(
      USER_ID,
      upload('big.png', 'image/png', MAX_FILE_BYTES + 1)
    );

    expect(result.status).toBe(413);
    expect(blob.upload).not.toHaveBeenCalled();
  });

  it('refuses an empty file', async () => {
    const result = await uploadAdminFileService(USER_ID, upload('empty.png', 'image/png', 0));

    expect(result.status).toBe(400);
  });

  it('falls back to a generic type when the browser sends none', async () => {
    await uploadAdminFileService(USER_ID, upload('unknown', '', 10));

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'application/octet-stream' })
    );
  });
});

describe('deleteAdminFileService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findById.mockResolvedValue(stored());
    repo.deleteById.mockResolvedValue(true);
    blob.remove.mockResolvedValue(true);
  });

  it('removes the row and then the bytes', async () => {
    const result = await deleteAdminFileService(FILE_ID);

    expect(result.status).toBe(200);
    expect(repo.deleteById).toHaveBeenCalledWith(FILE_ID);
    expect(blob.remove).toHaveBeenCalledWith('https://blob.example/scan-abc123.png');
  });

  it('still reports success when the blob delete fails', async () => {
    // The row is already gone; failing here would leave the admin retrying a delete that cannot
    // succeed, against a record they can no longer see.
    blob.remove.mockResolvedValue(false);

    const result = await deleteAdminFileService(FILE_ID);

    expect(result.status).toBe(200);
  });

  it('404s on a file that does not exist, without touching storage', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await deleteAdminFileService(FILE_ID);

    expect(result.status).toBe(404);
    expect(blob.remove).not.toHaveBeenCalled();
  });
});
