import { del, put } from '@vercel/blob';

export type BlobUploadResult =
  | { ok: true; url: string; pathname: string }
  | { ok: false; message: string };

/**
 * File storage on Vercel Blob.
 *
 * Wrapped rather than called directly for the reason every other client here is: the SDK throws,
 * and a route that lets a storage outage become a 500 tells the admin nothing about what failed.
 * Every call returns a typed result the caller has to look at.
 *
 * `isConfigured` mirrors `ResendClient`: a deployment without a Blob token degrades to "uploads
 * refused with a clear message" instead of throwing somewhere further down.
 *
 * Uploads are public. `addRandomSuffix` keeps two files of the same name from overwriting each
 * other, and means a URL cannot be guessed from the filename alone — but a public Blob URL is
 * readable by anyone who holds it, so nothing clinical belongs here. Patient photos need the
 * private-store treatment specced in PRD 06 §3.
 */
class BlobClient {
  private token(): string {
    return process.env.BLOB_READ_WRITE_TOKEN ?? '';
  }

  isConfigured(): boolean {
    return this.token().length > 0;
  }

  async upload(name: string, body: File | Blob | ArrayBuffer): Promise<BlobUploadResult> {
    if (!this.isConfigured()) return { ok: false, message: 'BLOB_NOT_CONFIGURED' };

    try {
      const result = await put(name, body, {
        access: 'public',
        addRandomSuffix: true,
        token: this.token(),
      });
      return { ok: true, url: result.url, pathname: result.pathname };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'BLOB_UPLOAD_FAILED';
      console.error('[blob] upload failed', message);
      return { ok: false, message };
    }
  }

  /**
   * Removes the stored bytes. Returns `true` when the blob is gone *or* was already gone — an
   * absent blob is the state the caller wanted, and reporting failure would strand the database
   * row that points at it, which is the one outcome with no way out from the console.
   */
  async remove(url: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      await del(url, { token: this.token() });
      return true;
    } catch (caught) {
      console.error('[blob] delete failed', caught instanceof Error ? caught.message : caught);
      return false;
    }
  }
}

export const blobClient = new BlobClient();
export { BlobClient };
