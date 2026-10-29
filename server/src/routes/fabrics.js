// Fabric photos. The image goes straight from the browser to object storage:
//   1. POST /v1/fabrics/:id/upload  -> "have" (already stored) or a signed upload link
//   2. the browser PUTs the image to that link
//   3. POST /v1/fabrics/:id/done    -> the server reads the image back, checks it is the picture the id names
//      (its sha-256), copies it to its lasting place and only then lists it for the user's other devices.
// Every upload goes to a new place (upload_key), so an upload link can never change a photo already checked.
import { createHash, randomUUID } from 'node:crypto';
import { lockOwner, tx } from '../db.js';
import { ApiError, fabricRecord } from '../records.js';

/** A request whose params, body and query the route's schema has already checked. @typedef {import('fastify').FastifyRequest & { params: any, body: any, query: any }} Req */

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: '^f[0-9a-f]{24}$' } }, // the app's id for a photo: 'f' + sha-256
};
/** The id of an image: 'f' + the first 12 bytes of its sha-256, as the app makes it. @param {Uint8Array} bytes */
export const fabricId = bytes => 'f' + createHash('sha256').update(bytes).digest('hex').slice(0, 24);

/**
 * @param {import('fastify').FastifyInstance} app @param {import('pg').Pool} pool
 * @param {import('../objects.js').ObjectStore} store @param {import('../config.js').Config} config
 */
export function fabricRoutes(app, pool, store, config) {
  const keyOf = (owner, id) => `fabrics/${owner}/${id}`;
  const uploadKeyOf = (owner, id) => `uploads/${owner}/${id}-${randomUUID()}`;
  const find = async (c, owner, id, lock = false) =>
    (await c.query(`select * from fabrics where owner_id = $1 and id = $2${lock ? ' for update' : ''}`, [owner, id]))
      .rows[0];

  app.post(
    '/v1/fabrics/:id/upload',
    {
      schema: {
        params: idParam,
        body: {
          type: 'object',
          required: ['name', 'cm', 'type', 'bytes'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            cm: { type: 'number', minimum: 1, maximum: 300 },
            type: { type: 'string', enum: TYPES },
            bytes: { type: 'integer', minimum: 1, maximum: config.maxFabricBytes },
          },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const owner = req.user.id,
        { id } = req.params,
        { name, cm, type, bytes } = req.body;
      const row = await tx(pool, async c => {
        await lockOwner(c, owner);
        const cur = await find(c, owner, id, true);
        if (cur && cur.uploaded && !cur.deleted) return cur;
        // new, or a photo that was deleted / never finished uploading: ready for an upload (not listed until done)
        const res = await c.query(
          `insert into fabrics (owner_id, id, name, cm, type, bytes, object_key, upload_key, uploaded, rev, seq)
           values ($1, $2, $3, $4, $5, $6, $7, $8, false, 0, nextval('change_seq'))
           on conflict (owner_id, id) do update set name = $3, cm = $4, type = $5, bytes = $6, upload_key = $8,
             uploaded = false, deleted = false, updated_at = now()
           returning *`,
          [owner, id, name, cm, type, bytes, keyOf(owner, id), uploadKeyOf(owner, id)],
        );
        return res.rows[0];
      });
      if (row.uploaded && !row.deleted) return { status: 'have', record: fabricRecord(row) };
      const up = await store.uploadUrl(row.upload_key, { type, bytes });
      return { status: 'upload', ...up };
    },
  );

  app.post('/v1/fabrics/:id/done', { schema: { params: idParam } }, async (/** @type {Req} */ req) => {
    const owner = req.user.id,
      { id } = req.params;
    const pending = await find(pool, owner, id);
    if (!pending) throw new ApiError(404, 'not_found', 'Ask for an upload link first.');
    if (pending.uploaded && !pending.deleted) return { record: fabricRecord(pending) };
    const data = await store.get(pending.upload_key);
    if (!data) throw new ApiError(409, 'not_uploaded', 'The image has not arrived in storage yet.');
    if (data.length !== pending.bytes || fabricId(data) !== id) {
      await store.remove(pending.upload_key);
      throw new ApiError(422, 'wrong_image', 'The uploaded image is not the one this fabric id names.');
    }
    await store.copy(pending.upload_key, pending.object_key);
    await store.remove(pending.upload_key);
    const row = await tx(pool, async c => {
      await lockOwner(c, owner);
      const res = await c.query(
        `update fabrics set uploaded = true, upload_key = null, rev = rev + 1, seq = nextval('change_seq'),
           updated_at = now()
         where owner_id = $1 and id = $2 returning *`,
        [owner, id],
      );
      return res.rows[0];
    });
    return { record: fabricRecord(row) };
  });

  app.get('/v1/fabrics/:id', { schema: { params: idParam } }, async (/** @type {Req} */ req) => {
    const row = await find(pool, req.user.id, req.params.id);
    if (!row || (!row.uploaded && !row.deleted)) throw new ApiError(404, 'not_found', 'No such fabric.');
    return { record: fabricRecord(row), url: row.deleted ? null : await store.downloadUrl(row.object_key) };
  });

  app.delete(
    '/v1/fabrics/:id',
    {
      schema: {
        params: idParam,
        querystring: {
          type: 'object',
          required: ['baseRev'],
          properties: { baseRev: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const owner = req.user.id;
      const row = await tx(pool, async c => {
        await lockOwner(c, owner);
        const cur = await find(c, owner, req.params.id, true);
        if (!cur || (!cur.uploaded && !cur.deleted)) throw new ApiError(404, 'not_found', 'No such fabric.');
        if (cur.rev !== req.query.baseRev)
          throw new ApiError(409, 'conflict', 'The fabric was changed somewhere else.', { server: fabricRecord(cur) });
        if (cur.deleted) return cur;
        const res = await c.query(
          `update fabrics set deleted = true, rev = rev + 1, seq = nextval('change_seq'), updated_at = now()
           where owner_id = $1 and id = $2 returning *`,
          [owner, cur.id],
        );
        return res.rows[0];
      });
      await store.remove(row.object_key);
      return { record: fabricRecord(row) };
    },
  );
}
