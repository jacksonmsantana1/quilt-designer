// Sync: everything of the user's that changed after change number `since` (quilts, fabric photos, deletion
// markers), oldest first. The app keeps the `since` it gets back and asks again from there; `more` says another
// page is waiting.
import { designRecord, fabricRecord } from '../records.js';

/** A request whose params, body and query the route's schema has already checked. @typedef {import('fastify').FastifyRequest & { params: any, body: any, query: any }} Req */

/** @param {import('fastify').FastifyInstance} app @param {import('pg').Pool} pool */
export function changeRoutes(app, pool) {
  app.get(
    '/v1/changes',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            since: { type: 'integer', minimum: 0, default: 0 },
            limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
          },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const { since, limit } = req.query,
        owner = req.user.id;
      // one more than asked, to know whether there is another page
      const [d, f] = await Promise.all([
        pool.query('select * from designs where owner_id = $1 and seq > $2 order by seq limit $3', [
          owner,
          since,
          limit + 1,
        ]),
        pool.query(
          'select * from fabrics where owner_id = $1 and seq > $2 and (uploaded or deleted) order by seq limit $3',
          [owner, since, limit + 1],
        ),
      ]);
      const all = [...d.rows.map(designRecord), ...f.rows.map(fabricRecord)].sort((a, b) => a.seq - b.seq);
      const page = all.slice(0, limit);
      return { changes: page, since: page.length ? page[page.length - 1].seq : since, more: all.length > limit };
    },
  );
}
