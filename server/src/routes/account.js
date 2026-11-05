// Deleting an account, which the app stores require people to be able to do from inside the app. Everything of theirs on
// this server goes: quilts, fabric and quilt photos, shared quilts with their pictures, folders, notes, blocks and reports.
// The sign-in itself lives at Auth0: without its removal there, signing in again only starts a new, empty account here.
import { ApiError } from '../records.js';

/** A request whose params, body and query the route's schema has already checked. @typedef {import('fastify').FastifyRequest & { params: any, body: any, query: any }} Req */

/**
 * @param {import('fastify').FastifyInstance} app @param {import('pg').Pool} pool
 * @param {import('../objects.js').ObjectStore} store @param {import('../config.js').Config} config
 */
export function accountRoutes(app, pool, store, config) {
  app.delete(
    '/v1/account',
    {
      config: { rateLimit: { max: Math.ceil(config.ratePerMinute / 10), timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['confirm'],
          additionalProperties: false,
          properties: { confirm: { type: 'string' } },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      if (req.body.confirm !== 'DELETE')
        throw new ApiError(400, 'bad_request', 'Deleting an account has to be confirmed.');
      const owner = req.user.id;
      // the images first: once the rows are gone, nothing says where they are
      const { rows } = await pool.query(
        `select object_key as key from fabrics where owner_id = $1
         union all select upload_key from fabrics where owner_id = $1
         union all select object_key from quilt_photos where owner_id = $1
         union all select upload_key from quilt_photos where owner_id = $1
         union all select picture_key from shared_designs where owner_id = $1
         union all select picture_upload_key from shared_designs where owner_id = $1`,
        [owner],
      );
      await pool.query('delete from users where id = $1', [owner]); // the rest goes with it (on delete cascade)
      // a picture that can't be removed now must not bring the account back: the error report will tell
      const failed = [];
      for (const { key } of rows) if (key) await store.remove(key).catch(e => failed.push(e));
      if (failed.length) req.log.error({ failed: failed.length }, 'Some images of a deleted account were not removed.');
      return { ok: true };
    },
  );
}
