import { del, get, put } from '@vercel/blob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BlobClient, isPrivateBlobPath, PRIVATE_BLOB_PREFIX } from '@/shared/lib/blob-client';

// Hoisted above the imports by Vitest, so the SDK is already mocked when the client loads.
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn(), get: vi.fn() }));

const putMock = vi.mocked(put);
const delMock = vi.mocked(del);
const getMock = vi.mocked(get);

const PUBLIC_TOKEN = 'vercel_blob_rw_publicstore_test';
const PRIVATE_TOKEN = 'vercel_blob_rw_privatestore_test';

const PRIVATE_PATH = `${PRIVATE_BLOB_PREFIX}clinic1/patient1/day7.jpg`;

const body = new ArrayBuffer(8);

const stored = { url: 'https://blob.example/x', pathname: PRIVATE_PATH };

const blobStream = () => new ReadableStream<Uint8Array>();

describe('BlobClient', () => {
  let client: BlobClient;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = PUBLIC_TOKEN;
    process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = PRIVATE_TOKEN;
    client = new BlobClient();
  });

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  });

  describe('without any token', () => {
    beforeEach(() => {
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
    });

    it('reports itself unconfigured', () => {
      expect(client.isConfigured()).toBe(false);
      expect(client.isPrivateConfigured()).toBe(false);
    });

    it('refuses a public upload with a named result rather than throwing', async () => {
      await expect(client.uploadPublic('logo.png', body)).resolves.toEqual({
        ok: false,
        message: 'BLOB_NOT_CONFIGURED',
      });
    });
  });

  /**
   * The two stores are separate on Vercel — a store is configured public *or* private, and the
   * public one rejects `access: 'private'` outright. Separate tokens are worth having anyway:
   * with one credential the admin-console path could read patient photographs and only
   * convention would stop it.
   */
  describe('with only the public token', () => {
    beforeEach(() => {
      delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
    });

    it('still serves public assets', () => {
      expect(client.isConfigured()).toBe(true);
      expect(client.isPrivateConfigured()).toBe(false);
    });

    it.each([
      ['uploadPrivate', () => client.uploadPrivate(PRIVATE_PATH, body)],
      ['readPrivate', () => client.readPrivate(PRIVATE_PATH)],
    ])('fails %s closed rather than falling back to the public store', async (_label, call) => {
      // A silent fallback would put a patient photograph in the store that serves publicly,
      // and that result is permanent.
      await expect(call()).resolves.toEqual({ ok: false, message: 'PRIVATE_BLOB_NOT_CONFIGURED' });
      expect(putMock).not.toHaveBeenCalled();
      expect(getMock).not.toHaveBeenCalled();
    });
  });

  describe('each half uses its own credential', () => {
    it('writes an asset with the public token', async () => {
      putMock.mockResolvedValue(stored as never);

      await client.uploadPublic('logo.png', body);

      expect(putMock.mock.calls[0][2]).toMatchObject({ token: PUBLIC_TOKEN });
    });

    it('writes a photograph with the private token', async () => {
      putMock.mockResolvedValue(stored as never);

      await client.uploadPrivate(PRIVATE_PATH, body);

      expect(putMock.mock.calls[0][2]).toMatchObject({ token: PRIVATE_TOKEN });
    });

    it('reads a photograph with the private token', async () => {
      getMock.mockResolvedValue({
        statusCode: 200,
        stream: blobStream(),
        blob: { contentType: 'image/jpeg', size: 1 },
      } as never);

      await client.readPrivate(PRIVATE_PATH);

      expect(getMock.mock.calls[0][1]).toMatchObject({ token: PRIVATE_TOKEN });
    });

    /**
     * A delete sent to the wrong store does not fail loudly — it succeeds at deleting nothing.
     * That is the worst outcome available here: account deletion would report success while the
     * patient's photographs stayed in storage.
     */
    it.each([
      ['a patient pathname', PRIVATE_PATH, PRIVATE_TOKEN],
      ['a patient url', `https://x.blob.vercel-storage.com/${PRIVATE_PATH}`, PRIVATE_TOKEN],
      ['an asset pathname', 'logo.png', PUBLIC_TOKEN],
    ])('routes a delete of %s to the right store', async (_label, target, token) => {
      delMock.mockResolvedValue(undefined as never);

      await client.remove(target);

      expect(delMock).toHaveBeenCalledWith(target, { token });
    });
  });

  /**
   * The invariant the whole split rests on. A public Blob URL is readable by anyone who ever
   * holds it, and deleting the blob afterwards does not un-share what was already fetched — so
   * "patient photograph uploaded to the public half" is a mistake with no remedy. Each method
   * refuses the other's prefix, which makes it a mistake you cannot make by passing one wrong
   * argument at a call site.
   */
  describe('the public and private halves cannot be mixed', () => {
    it('refuses a patient path on the public upload', async () => {
      const result = await client.uploadPublic(PRIVATE_PATH, body);

      expect(result).toEqual({ ok: false, message: 'PRIVATE_PATH_ON_PUBLIC_UPLOAD' });
      expect(putMock).not.toHaveBeenCalled();
    });

    it('refuses a non-patient path on the private upload', async () => {
      const result = await client.uploadPrivate('logo.png', body);

      expect(result).toEqual({ ok: false, message: 'PUBLIC_PATH_ON_PRIVATE_UPLOAD' });
      expect(putMock).not.toHaveBeenCalled();
    });

    it('refuses to read anything outside the private prefix', async () => {
      // Otherwise this becomes a general proxy that fetches public assets for whoever asks.
      const result = await client.readPrivate('marketing/hero.png');

      expect(result).toEqual({ ok: false, message: 'NOT_A_PRIVATE_PATH' });
      expect(getMock).not.toHaveBeenCalled();
    });
  });

  describe('uploading', () => {
    beforeEach(() => {
      putMock.mockResolvedValue(stored as never);
    });

    it('stores an asset publicly', async () => {
      await client.uploadPublic('logo.png', body);

      expect(putMock.mock.calls[0][2]).toMatchObject({ access: 'public', addRandomSuffix: true });
    });

    it('stores a patient photograph privately', async () => {
      await client.uploadPrivate(PRIVATE_PATH, body);

      expect(putMock.mock.calls[0][2]).toMatchObject({ access: 'private', addRandomSuffix: true });
    });

    it('returns the stored url and pathname', async () => {
      await expect(client.uploadPrivate(PRIVATE_PATH, body)).resolves.toEqual({
        ok: true,
        url: stored.url,
        pathname: stored.pathname,
      });
    });

    it('turns a thrown SDK error into a result the caller has to read', async () => {
      putMock.mockRejectedValue(new Error('This store does not exist'));

      await expect(client.uploadPrivate(PRIVATE_PATH, body)).resolves.toEqual({
        ok: false,
        message: 'This store does not exist',
      });
    });

    it('never logs the pathname, which names the clinic and the patient', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      putMock.mockRejectedValue(new Error('boom'));

      await client.uploadPrivate(PRIVATE_PATH, body);

      expect(JSON.stringify(logged.mock.calls)).not.toContain('patient1');
      logged.mockRestore();
    });
  });

  describe('reading a private blob', () => {
    it('bypasses the CDN', async () => {
      // A cached photograph outlives the authorisation that produced it, on a node no
      // revocation reaches. That is the whole reason these are private and not merely unguessable.
      getMock.mockResolvedValue({
        statusCode: 200,
        stream: blobStream(),
        blob: { contentType: 'image/jpeg', size: 1024 },
      } as never);

      await client.readPrivate(PRIVATE_PATH);

      expect(getMock.mock.calls[0][1]).toMatchObject({ access: 'private', useCache: false });
    });

    it('returns the stream with its type and size', async () => {
      getMock.mockResolvedValue({
        statusCode: 200,
        stream: blobStream(),
        blob: { contentType: 'image/jpeg', size: 1024 },
      } as never);

      const result = await client.readPrivate(PRIVATE_PATH);

      expect(result).toMatchObject({ ok: true, contentType: 'image/jpeg', size: 1024 });
    });

    it('reports a missing blob rather than returning an empty stream', async () => {
      getMock.mockResolvedValue(null as never);

      await expect(client.readPrivate(PRIVATE_PATH)).resolves.toEqual({
        ok: false,
        message: 'BLOB_NOT_FOUND',
      });
    });

    it('refuses a 304, which carries no body', async () => {
      getMock.mockResolvedValue({ statusCode: 304, stream: null, blob: {} } as never);

      await expect(client.readPrivate(PRIVATE_PATH)).resolves.toEqual({
        ok: false,
        message: 'BLOB_NOT_READABLE',
      });
    });

    it('turns a thrown read into a result', async () => {
      getMock.mockRejectedValue(new Error('Access denied'));

      await expect(client.readPrivate(PRIVATE_PATH)).resolves.toEqual({
        ok: false,
        message: 'Access denied',
      });
    });
  });

  describe('removing', () => {
    it('deletes by pathname or url', async () => {
      delMock.mockResolvedValue(undefined as never);

      await expect(client.remove(PRIVATE_PATH)).resolves.toBe(true);
      expect(delMock).toHaveBeenCalledWith(PRIVATE_PATH, { token: PRIVATE_TOKEN });
    });

    it('reports failure rather than throwing', async () => {
      delMock.mockRejectedValue(new Error('gone wrong'));

      await expect(client.remove(PRIVATE_PATH)).resolves.toBe(false);
    });
  });

  describe('isPrivateBlobPath', () => {
    it.each([
      [PRIVATE_PATH, true],
      ['patients/anything', true],
      ['marketing/hero.png', false],
      ['', false],
      // Not a prefix match: a folder that merely starts with the same letters is not the same folder.
      ['patients-archive/x.jpg', false],
      ['other/patients/x.jpg', false],
    ])('%s → %s', (path, expected) => {
      expect(isPrivateBlobPath(path)).toBe(expected);
    });
  });
});
