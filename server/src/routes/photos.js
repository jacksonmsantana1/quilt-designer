// Photos of real quilts, taken with the phone app. They are private. The image goes straight to object storage, as fabric
// photos do: a signed link to a fresh place, then `done` checks it and moves it to its lasting place.
import { randomUUID } from 'node:crypto';
import { ApiError } from '../records.js';

/** A request whose params, body and query the route's schema has already checked. @typedef {import('fastify').FastifyRequest & { params: any, body: any, query: any }} Req */

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};
/** Whether these bytes start the way a JPEG image does. @param {Uint8Array} b */
const isJpeg = b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** How much photo storage a person uses: their fabric photos and their quilt photos. */
export async function photoBytesUsed(pool, owner) {
  const { rows } = await pool.query(
    `select coalesce((select sum(bytes) from fabrics where owner_id = $1 and not deleted), 0)
          + coalesce((select sum(bytes) from quilt_photos where owner_id = $1), 0) as used`,
    [owner],
  );
  return Number(rows[0].used);
}

/**
 * @param {import('fastify').FastifyInstance} app @param {import('pg').Pool} pool
 * @param {import('../objects.js').ObjectStore} store @param {import('../config.js').Config} config
 */
export function photoRoutes(app, pool, store, config) {
  const fewer = { max: Math.ceil(config.ratePerMinute / 10), timeWindow: '1 minute' };
  const record = async r => ({
    id: r.id,
    quiltId: r.quilt_id,
    album: r.album,
    bytes: r.bytes,
    takenAt: new Date(r.taken_at).getTime(),
    url: await store.downloadUrl(r.object_key),
  });
  const find = async (owner, id) =>
    (await pool.query('select * from quilt_photos where owner_id = $1 and id = $2', [owner, id])).rows[0];

  // All my photos, newest first.
  app.get('/v1/photos', async (/** @type {Req} */ req) => {
    const { rows } = await pool.query(
      'select * from quilt_photos where owner_id = $1 and uploaded order by taken_at desc limit 2000',
      [req.user.id],
    );
    return { items: await Promise.all(rows.map(record)) };
  });

  // A link to upload a photo to. Asking again for the same photo is fine: a phone may have lost the connection halfway.
  app.post(
    '/v1/photos/:id/upload',
    {
      config: { rateLimit: fewer },
      schema: {
        params: idParam,
        body: {
          type: 'object',
          required: ['quiltId', 'bytes', 'takenAt'],
          additionalProperties: false,
          properties: {
            quiltId: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
            album: { type: 'string', minLength: 1, maxLength: 80 },
            bytes: { type: 'integer', minimum: 1, maximum: MAX_PHOTO_BYTES },
            takenAt: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const owner = req.user.id,
        { id } = req.params,
        { quiltId, album, bytes, takenAt } = req.body;
      const cur = await find(owner, id);
      if (cur?.uploaded) return { status: 'have', record: await record(cur) };
      if ((await photoBytesUsed(pool, owner)) + bytes > config.perPerson.photoBytes)
        throw new ApiError(413, 'storage_full', 'There is no more room in this account.');
      const key = `uploads/${owner}/photo-${randomUUID()}`;
      await pool.query(
        `insert into quilt_photos (owner_id, id, quilt_id, album, bytes, object_key, upload_key, taken_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (owner_id, id) do update
           set quilt_id = $3, album = $4, bytes = $5, upload_key = $7, taken_at = $8`,
        [owner, id, quiltId, album ?? null, bytes, `photos/${owner}/${id}.jpg`, key, new Date(takenAt)],
      );
      if (cur?.upload_key) await store.remove(cur.upload_key);
      return { status: 'upload', ...(await store.uploadUrl(key, { type: 'image/jpeg', bytes })) };
    },
  );

  // The photo is uploaded: read it back, check it is what was announced, and keep it.
  app.post(
    '/v1/photos/:id/done',
    { config: { rateLimit: fewer }, schema: { params: idParam } },
    async (/** @type {Req} */ req) => {
      const owner = req.user.id,
        cur = await find(owner, req.params.id);
      if (!cur) throw new ApiError(404, 'not_found', 'Ask for an upload link first.');
      if (cur.uploaded) return { record: await record(cur) };
      const data = await store.get(cur.upload_key);
      if (!data) throw new ApiError(409, 'not_uploaded', 'The image has not arrived in storage yet.');
      if (data.length !== cur.bytes || !isJpeg(data)) {
        await store.remove(cur.upload_key);
        await pool.query('delete from quilt_photos where owner_id = $1 and id = $2', [owner, cur.id]);
        throw new ApiError(400, 'not_a_picture', 'That file is not the JPEG picture announced.');
      }
      await store.copy(cur.upload_key, cur.object_key);
      await store.remove(cur.upload_key);
      const { rows } = await pool.query(
        `update quilt_photos set uploaded = true, upload_key = null where owner_id = $1 and id = $2 returning *`,
        [owner, cur.id],
      );
      return { record: await record(rows[0]) };
    },
  );

  // Deleting a photo. Deleting one that is already gone is fine: another device may have got there first.
  app.delete('/v1/photos/:id', { schema: { params: idParam } }, async (/** @type {Req} */ req) => {
    const { rows } = await pool.query(
      'delete from quilt_photos where owner_id = $1 and id = $2 returning object_key, upload_key',
      [req.user.id, req.params.id],
    );
    for (const key of [rows[0]?.object_key, rows[0]?.upload_key]) if (key) await store.remove(key);
    return { ok: true };
  });
}
