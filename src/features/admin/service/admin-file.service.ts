import { Types } from 'mongoose';

import { AdminFileListView, AdminFileView } from '@/features/admin/types/admin.types';
import { AdminListQueryType } from '@/features/admin/validations/admin.validation';
import { fileRepository } from '@/features/file/repository/file.repository';
import { FileDocument } from '@/features/file/schema/file.schema';
import { blobClient } from '@/shared/lib/blob-client';
import { ServiceResult } from '@/shared/types/common';

/** Refused outright. A file the browser will execute is not a file this console needs to hold. */
const BLOCKED_TYPES = ['text/html', 'image/svg+xml', 'application/xhtml+xml'];

/** 10 MB. Above this the request body is a problem before the storage bill is. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

function toView(file: FileDocument): AdminFileView {
  return {
    id: file._id.toString(),
    name: file.name,
    url: file.url,
    mimeType: file.mimeType,
    size: file.size,
    uploadedByUserId: file.uploadedByUserId.toString(),
    createdAt: (file.createdAt ?? new Date()).toISOString(),
  };
}

export async function listAdminFilesService(
  query: AdminListQueryType
): Promise<ServiceResult<AdminFileListView>> {
  const skip = (query.page - 1) * query.pageSize;
  const { items, total } = await fileRepository.findPage(skip, query.pageSize);

  return {
    data: { items: items.map(toView), total, page: query.page, pageSize: query.pageSize },
    status: 200,
  };
}

/**
 * Stores an uploaded file: bytes to Blob, then a row pointing at them.
 *
 * That order is deliberate and is the same order the delete reverses. A blob with no row costs
 * storage and is invisible; a row with no blob is a broken entry in the console that cannot be
 * cleared. Given one of the two has to be possible, it is the cheap one.
 *
 * `image/svg+xml` and `text/html` are refused. Blob serves what it is given from a URL a patient
 * or a clinic might be handed, and both formats execute script in the browser — an SVG upload is
 * a stored cross-site scripting payload wearing an image's file extension.
 */
export async function uploadAdminFileService(
  uploaderId: string,
  file: File
): Promise<ServiceResult<AdminFileView>> {
  if (file.size === 0) return { data: { error: 'EMPTY_FILE' }, status: 400 };
  if (file.size > MAX_FILE_BYTES) return { data: { error: 'FILE_TOO_LARGE' }, status: 413 };
  if (BLOCKED_TYPES.includes(file.type)) {
    return { data: { error: 'UNSUPPORTED_TYPE' }, status: 415 };
  }

  const stored = await blobClient.upload(file.name, file);
  if (!stored.ok) {
    return { data: { error: stored.message }, status: 502 };
  }

  const id = await fileRepository.create({
    name: file.name,
    pathname: stored.pathname,
    url: stored.url,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedByUserId: new Types.ObjectId(uploaderId),
  });

  const created = await fileRepository.findById(id);
  if (!created) return { data: { error: 'FILE_CREATE_FAILED' }, status: 500 };

  return { data: toView(created), status: 201 };
}

/**
 * Removes a file. The row goes first, then the bytes.
 *
 * A blob left behind by a failed delete is unreferenced and unreachable; a row left behind by a
 * failed row-delete points at bytes that are gone. The console can survive the first and cannot
 * clear the second, so the row is removed even when Blob refuses — the failure is logged by the
 * client rather than returned, because a delete the admin has to retry against an already-deleted
 * blob will never succeed.
 */
export async function deleteAdminFileService(
  id: string
): Promise<ServiceResult<{ deleted: true }>> {
  const file = await fileRepository.findById(id);
  if (!file) return { data: { error: 'NOT_FOUND' }, status: 404 };

  const removed = await fileRepository.deleteById(id);
  if (!removed) return { data: { error: 'NOT_FOUND' }, status: 404 };

  await blobClient.remove(file.url);

  return { data: { deleted: true }, status: 200 };
}
