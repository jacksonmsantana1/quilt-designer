// Saved quilts: read, save (create or change) and delete one, each checked against its save counter.
import { readDesign } from '@quilt/shared/format.js';
import { lockOwner, tx } from '../db.js';
import { ApiError, designRecord } from '../records.js';

/** A request whose params, body and query the route's schema has already checked. @typedef {import('fastify').FastifyRequest & { params: any, body: any, query: any }} Req */

const idParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};
const baseRevQuery = {
  type: 'object',
  required: ['baseRev'],
  properties: { baseRev: { type: 'integer', minimum: 1 } },
};

/** @param {import('fastify').FastifyInstance} app @param {import('pg').Pool} pool */
export function designRoutes(app, pool) {
  app.get('/v1/designs/:id', { schema: { params: idParam } }, async (/** @type {Req} */ req) => {
    const { rows } = await pool.query('select * from designs where id = $1 and owner_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (!rows.length) throw new ApiError(404, 'not_found', 'No such design.');
    return designRecord(rows[0]);
  });

  // Save a design. baseRev is the save counter the app's copy is based on: 0 for a new design. If the server's
  // copy has moved on (another device saved it), nothing is changed and the answer is 409 with the server's copy,
  // so the app can keep both.
  app.put(
    '/v1/designs/:id',
    {
      schema: {
        params: idParam,
        body: {
          type: 'object',
          required: ['name', 'design', 'baseRev'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            design: { type: 'object' },
            baseRev: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (/** @type {Req} */ req, reply) => {
      const { name, design, baseRev } = req.body;
      // the same checks the app makes when it opens a quilt (shared/src/format.js)
      const r = readDesign(design);
      if (!r) throw new ApiError(400, 'not_a_quilt', 'The design could not be read as a quilt.');
      if (r.newer)
        throw new ApiError(
          422,
          'newer_format',
          'The design was made with a newer version of the app than this server knows.',
        );
      const out = await tx(pool, async c => {
        await lockOwner(c, req.user.id);
        const { rows } = await c.query('select * from designs where id = $1 for update', [req.params.id]);
        const cur = rows[0];
        if (cur && cur.owner_id !== req.user.id) throw new ApiError(404, 'not_found', 'No such design.');
        if ((cur ? cur.rev : 0) !== baseRev)
          throw new ApiError(409, 'conflict', 'The design was changed somewhere else.', {
            server: cur ? designRecord(cur) : null,
          });
        const q = cur
          ? `update designs set name = $3, doc = $4, format_version = $5, rev = rev + 1, seq = nextval('change_seq'),
               deleted = false, updated_at = now()
             where id = $1 and owner_id = $2 returning *`
          : `insert into designs (id, owner_id, name, doc, format_version, rev, seq)
             values ($1, $2, $3, $4, $5, 1, nextval('change_seq')) returning *`;
        const res = await c.query(q, [req.params.id, req.user.id, name, r.design, r.design.v]);
        return { created: !cur, row: res.rows[0] };
      });
      reply.code(out.created ? 201 : 200);
      return { record: designRecord(out.row), problems: r.problems };
    },
  );

  // Delete: the row stays as a marker (deleted, no quilt) so other devices learn of it.
  app.delete(
    '/v1/designs/:id',
    { schema: { params: idParam, querystring: baseRevQuery } },
    async (/** @type {Req} */ req) => {
      const row = await tx(pool, async c => {
        await lockOwner(c, req.user.id);
        const { rows } = await c.query('select * from designs where id = $1 and owner_id = $2 for update', [
          req.params.id,
          req.user.id,
        ]);
        const cur = rows[0];
        if (!cur) throw new ApiError(404, 'not_found', 'No such design.');
        if (cur.rev !== req.query.baseRev)
          throw new ApiError(409, 'conflict', 'The design was changed somewhere else.', { server: designRecord(cur) });
        if (cur.deleted) return cur;
        const res = await c.query(
          `update designs set doc = null, deleted = true, rev = rev + 1, seq = nextval('change_seq'), updated_at = now()
         where id = $1 returning *`,
          [cur.id],
        );
        return res.rows[0];
      });
      return { record: designRecord(row) };
    },
  );
}
