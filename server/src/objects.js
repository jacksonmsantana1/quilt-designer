// Object storage for fabric photos: S3-compatible (Cloudflare R2 in production, MinIO in development), and an
// in-memory stand-in for the tests. The browser uploads straight to storage through a short-lived signed link,
// so photos never pass through the API server.
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * @typedef {object} ObjectStore
 * @property {(key: string, o: { type: string, bytes: number }) => Promise<{ url: string, headers: Record<string, string> }>} uploadUrl
 *   a link the browser can PUT the image to, for 10 minutes; only that type and size are accepted
 * @property {(key: string) => Promise<string>} downloadUrl  a link to read the image, for an hour
 * @property {(key: string) => Promise<Uint8Array | null>} get  the stored bytes (null if missing)
 * @property {(key: string) => Promise<void>} remove
 * @property {(from: string, to: string) => Promise<void>} copy  inside the storage, without passing through the server
 */

const UPLOAD_SECONDS = 600,
  DOWNLOAD_SECONDS = 3600;

/** @param {import('./config.js').Config['s3']} cfg @returns {ObjectStore} */
export function s3Store(cfg) {
  const s3 = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  const Bucket = cfg.bucket;
  return {
    async uploadUrl(key, { type, bytes }) {
      const cmd = new PutObjectCommand({ Bucket, Key: key, ContentType: type, ContentLength: bytes });
      // content-type and content-length are part of the signature: a different file is refused by storage
      const url = await getSignedUrl(s3, cmd, {
        expiresIn: UPLOAD_SECONDS,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      return { url, headers: { 'content-type': type } };
    },
    downloadUrl: key => getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: DOWNLOAD_SECONDS }),
    async get(key) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
      } catch (e) {
        if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return null;
        throw e;
      }
      const r = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
      return r.Body ? await r.Body.transformToByteArray() : null;
    },
    async remove(key) {
      await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async copy(from, to) {
      await s3.send(new CopyObjectCommand({ Bucket, Key: to, CopySource: `${Bucket}/${from}` }));
    },
  };
}

/** In memory, for tests: `put` stands in for the browser's upload. @returns {ObjectStore & { put(key: string, bytes: Uint8Array): void, keys(): string[] }} */
export function memoryStore() {
  /** @type {Map<string, Uint8Array>} */
  const m = new Map();
  return {
    uploadUrl: async (key, { type }) => ({ url: `memory://${key}`, headers: { 'content-type': type } }),
    downloadUrl: async key => `memory://${key}`,
    get: async key => m.get(key) ?? null,
    remove: async key => void m.delete(key),
    copy: async (from, to) => void m.set(to, /** @type {Uint8Array} */ (m.get(from))),
    put: (key, bytes) => void m.set(key, bytes),
    keys: () => [...m.keys()],
  };
}
