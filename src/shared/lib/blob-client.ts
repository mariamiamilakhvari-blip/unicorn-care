import { del, get, put } from '@vercel/blob';

export type BlobUploadResult =
  | { ok: true; url: string; pathname: string }
  | { ok: false; message: string };

/** A private read never returns a URL — only bytes, and only to code that already checked who asked. */
export type BlobReadResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; contentType: string; size: number }
  | { ok: false; message: string };

/**
 * Everything under this prefix is private, and nothing else is.
 *
 * The prefix is the invariant the two upload methods enforce in opposite directions: a public
 * upload cannot write here, and a private upload cannot write anywhere else. That makes the
 * question "could this blob be public?" answerable from its pathname alone, without trusting
 * that whoever stored it passed the right flag.
 */
export const PRIVATE_BLOB_PREFIX = 'patients/';

export function isPrivateBlobPath(pathname: string): boolean {
  return pathname.startsWith(PRIVATE_BLOB_PREFIX);
}

/**
 * File storage on Vercel Blob.
 *
 * Wrapped rather than called directly for the reason every other client here is: the SDK throws,
 * and a route that lets a storage outage become a 500 tells the caller nothing about what failed.
 * Every call returns a typed result the caller has to look at.
 *
 * `isConfigured` mirrors `ResendClient`: a deployment without a Blob token degrades to "uploads
 * refused with a clear message" instead of throwing somewhere further down.
 *
 * There are two upload methods and no `access` parameter. A boolean argument would make
 * "publish a patient's post-operative photograph" a one-character mistake at a call site, and
 * that mistake is unrecoverable — a public Blob URL is readable by anyone who ever holds it, and
 * deleting the blob afterwards does not un-share what was already fetched. Two differently named
 * methods, each refusing the other's prefix, make the wrong thing hard to type by accident.
 */
class BlobClient {
  /** Public store — admin console assets. */
  private publicToken(): string {
    return process.env.BLOB_READ_WRITE_TOKEN ?? '';
  }

  /**
   * Private store — patient photographs, and nothing else.
   *
   * A separate store because Vercel configures access per store: the public one rejects
   * `access: 'private'` outright. A separate *token* because that is worth having anyway — with
   * one credential, the admin-console code path could read patient photographs and only
   * convention would stop it. With two, it cannot.
   */
  private privateToken(): string {
    return process.env.BLOB_PRIVATE_READ_WRITE_TOKEN ?? '';
  }

  isConfigured(): boolean {
    return this.publicToken().length > 0;
  }

  /**
   * Deliberately separate from `isConfigured`. A deployment with only the public token must
   * refuse photograph uploads rather than fall back to the store that serves everything
   * publicly — the fallback would be silent, and its result permanent.
   */
  isPrivateConfigured(): boolean {
    return this.privateToken().length > 0;
  }

  /**
   * Public asset upload — admin console files, logos, marketing images.
   *
   * Readable by anyone holding the URL, so nothing clinical belongs here. `addRandomSuffix` stops
   * two files of the same name overwriting each other and means the URL cannot be guessed from
   * the filename, but an unguessable public URL is still a public URL.
   */
  async uploadPublic(name: string, body: File | Blob | ArrayBuffer): Promise<BlobUploadResult> {
    if (!this.isConfigured()) return { ok: false, message: 'BLOB_NOT_CONFIGURED' };
    /*
      The guard that makes the split mean something. Without it, a caller who passes a
      patient-scoped pathname to the public method gets a permanently public patient photograph
      and no error. Refused here rather than at the route, so every present and future caller of
      the public path is covered by one check.
    */
    if (isPrivateBlobPath(name)) return { ok: false, message: 'PRIVATE_PATH_ON_PUBLIC_UPLOAD' };

    return this.write(name, body, 'public');
  }

  /**
   * Private upload — patient photographs and anything else that is clinical.
   *
   * The pathname must sit under `PRIVATE_BLOB_PREFIX`, which is what keeps the two halves of the
   * store from mixing. Stored bytes are unreadable without a signed request, so the only way to
   * serve one is `readPrivate` behind a guard.
   */
  async uploadPrivate(pathname: string, body: File | Blob | ArrayBuffer): Promise<BlobUploadResult> {
    if (!this.isPrivateConfigured()) return { ok: false, message: 'PRIVATE_BLOB_NOT_CONFIGURED' };
    if (!isPrivateBlobPath(pathname)) {
      return { ok: false, message: 'PUBLIC_PATH_ON_PRIVATE_UPLOAD' };
    }

    return this.write(pathname, body, 'private');
  }

  private async write(
    pathname: string,
    body: File | Blob | ArrayBuffer,
    access: 'public' | 'private'
  ): Promise<BlobUploadResult> {
    try {
      const result = await put(pathname, body, {
        access,
        addRandomSuffix: true,
        token: access === 'private' ? this.privateToken() : this.publicToken(),
      });
      return { ok: true, url: result.url, pathname: result.pathname };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'BLOB_UPLOAD_FAILED';
      // Never logs the pathname: it carries the clinic and patient ids for a private blob.
      console.error('[blob] upload failed', message);
      return { ok: false, message };
    }
  }

  /**
   * Reads a private blob's bytes, server-side.
   *
   * `useCache: false` keeps the read off the CDN. A cached copy of a post-operative photograph
   * would outlive the authorisation that produced it and sit on an edge node no revocation
   * reaches — which is the whole reason these are private rather than merely unguessable.
   *
   * Refuses any pathname outside the private prefix, so this can never be turned into a general
   * proxy that fetches public assets on a caller's behalf.
   */
  async readPrivate(pathname: string): Promise<BlobReadResult> {
    if (!this.isPrivateConfigured()) return { ok: false, message: 'PRIVATE_BLOB_NOT_CONFIGURED' };
    if (!isPrivateBlobPath(pathname)) return { ok: false, message: 'NOT_A_PRIVATE_PATH' };

    try {
      const result = await get(pathname, {
        access: 'private',
        useCache: false,
        token: this.privateToken(),
      });

      if (!result) return { ok: false, message: 'BLOB_NOT_FOUND' };
      if (result.statusCode !== 200 || !result.stream) {
        return { ok: false, message: 'BLOB_NOT_READABLE' };
      }

      return {
        ok: true,
        stream: result.stream,
        contentType: result.blob.contentType || 'application/octet-stream',
        size: result.blob.size ?? 0,
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'BLOB_READ_FAILED';
      console.error('[blob] private read failed', message);
      return { ok: false, message };
    }
  }

  /**
   * Removes the stored bytes, by URL or by pathname.
   *
   * Returns `true` when the blob is gone *or* was already gone — an absent blob is the state the
   * caller wanted, and reporting failure would strand the database row that points at it, which
   * is the one outcome with no way out from the console.
   */
  async remove(urlOrPathname: string): Promise<boolean> {
    /*
      Routed by path, because the two stores are separate and a delete sent to the wrong one does
      not fail loudly — it succeeds at deleting nothing. That is the worst outcome here: account
      deletion would report success while the patient's photographs stayed in storage.
    */
    const isPrivate = isPrivateBlobPath(urlOrPathname) || urlOrPathname.includes(PRIVATE_BLOB_PREFIX);
    const token = isPrivate ? this.privateToken() : this.publicToken();
    if (!token) return false;

    try {
      await del(urlOrPathname, { token });
      return true;
    } catch (caught) {
      console.error('[blob] delete failed', caught instanceof Error ? caught.message : caught);
      return false;
    }
  }
}

export const blobClient = new BlobClient();
export { BlobClient };
