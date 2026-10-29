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
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

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

/**
 * Development only: photos kept in a folder on this computer and served by the API itself under /dev-files/,
 * so the app can sync photos without MinIO. Links carry a signature and an expiry like S3's. Refused in
 * production (config.js).
 * @param {string} dir @param {string | (() => string)} publicUrl the API's address as the browser sees it
 *   (a function when it is known only once the server listens)
 * @returns {ObjectStore & { routes(app: import('fastify').FastifyInstance, maxBytes: number): void }}
 */
export function localStore(dir, publicUrl) {
  const secret = randomBytes(32);
  const file = key => {
    const p = path.resolve(dir, key);
    if (!p.startsWith(path.resolve(dir) + path.sep)) throw new Error('bad key');
    return p;
  };
  const sign = (key, method, exp, type = '', bytes = '') =>
    createHmac('sha256', secret).update([method, key, exp, type, bytes].join('\n')).digest('hex');
  const link = (key, method, seconds, type, bytes) => {
    const exp = Math.floor(Date.now() / 1000) + seconds;
    const q = new URLSearchParams({ exp: String(exp), sig: sign(key, method, exp, type, bytes) });
    const base = typeof publicUrl === 'function' ? publicUrl() : publicUrl;
    return `${base.replace(/\/+$/, '')}/dev-files/${key}?${q}`;
  };
  const ok = (key, method, q, type = '', bytes = '') => {
    if (!q.exp || !q.sig || +q.exp < Date.now() / 1000) return false;
    const want = Buffer.from(sign(key, method, q.exp, type, bytes)),
      got = Buffer.from(String(q.sig));
    return want.length === got.length && timingSafeEqual(want, got);
  };
  return {
    uploadUrl: async (key, { type, bytes }) => ({
      url: link(key, 'PUT', UPLOAD_SECONDS, type, String(bytes)),
      headers: { 'content-type': type },
    }),
    downloadUrl: async key => link(key, 'GET', DOWNLOAD_SECONDS),
    async get(key) {
      try {
        return new Uint8Array(await fs.readFile(file(key)));
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    async remove(key) {
      await fs.rm(file(key), { force: true });
    },
    async copy(from, to) {
      await fs.mkdir(path.dirname(file(to)), { recursive: true });
      await fs.copyFile(file(from), file(to));
    },
    routes(app, maxBytes) {
      app.register(async inst => {
        inst.addContentTypeParser(
          ['image/jpeg', 'image/png', 'image/webp'],
          { parseAs: 'buffer', bodyLimit: maxBytes },
          (req, body, done) => done(null, body),
        );
        inst.put('/dev-files/*', async (req, reply) => {
          const key = /** @type {any} */ (req.params)['*'],
            body = /** @type {Buffer} */ (req.body);
          const type = String(req.headers['content-type'] || '');
          if (!ok(key, 'PUT', req.query, type, String(body?.length ?? '')))
            return reply
              .code(403)
              .send({ error: 'forbidden', message: 'This upload link is not valid (or has expired).' });
          await fs.mkdir(path.dirname(file(key)), { recursive: true });
          await fs.writeFile(file(key), body);
          return reply.code(200).send();
        });
        inst.get('/dev-files/*', async (req, reply) => {
          const key = /** @type {any} */ (req.params)['*'];
          if (!ok(key, 'GET', req.query))
            return reply.code(403).send({ error: 'forbidden', message: 'This link is not valid (or has expired).' });
          const data = await fs.readFile(file(key)).catch(() => null);
          if (!data) return reply.code(404).send({ error: 'not_found', message: 'No such file.' });
          return reply.type('application/octet-stream').send(Buffer.from(data));
        });
      });
    },
  };
}
