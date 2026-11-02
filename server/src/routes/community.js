// Quilts shared with the community. The owner shares a copy of one of their designs (PUT, again to update it) and
// can stop sharing (DELETE); anyone, signed in or not, can list them (GET /v1/community, newest first). A shared
// quilt shows the author name its owner chose, never their email. Its fabric photos come with signed links, so
// viewers see them (and can keep a copy when they copy the quilt).
import { readQuilt } from '../read-quilt.js';
import { ApiError } from '../records.js';

/** A request whose params, body and query the route's schema has already checked. @typedef {import('fastify').FastifyRequest & { params: any, body: any, query: any }} Req */

const designIdParam = {
  type: 'object',
  required: ['designId'],
  properties: { designId: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' } },
};
const PHOTO_ID = /^f[0-9a-f]{24}$/;
const PAGE = 30;
/** One page of the public list stops at about this much quilt data; the next page brings the rest. */
const PAGE_BYTES = 4 * 1024 * 1024;
/** This many different people reporting a quilt hide it until someone looks at it (scripts/moderate.js). */
const REPORTS_TO_HIDE = 3;

/** The photo fabrics a quilt uses: every string in it that is a photo's id. @param {any} doc @returns {string[]} */
function photoIds(doc) {
  const out = new Set();
  const walk = x => {
    if (typeof x === 'string') {
      if (PHOTO_ID.test(x)) out.add(x);
    } else if (x && typeof x === 'object') for (const v of Object.values(x)) walk(v);
  };
  walk(doc);
  return [...out].sort();
}

/**
 * @param {import('fastify').FastifyInstance} app @param {import('pg').Pool} pool
 * @param {import('../objects.js').ObjectStore} store @param {import('../config.js').Config} config
 */
export function communityRoutes(app, pool, store, config) {
  // what anyone can ask for without signing in, and what puts something in front of everyone: fewer than other requests
  const fewer = { max: Math.ceil(config.ratePerMinute / 10), timeWindow: '1 minute' };
  /** A shared quilt as the API sends it, with links to its photos. */
  async function sharedRecord(r, me) {
    const photos = r.fabric_ids.length
      ? (
          await pool.query(
            `select id, name, cm, object_key from fabrics
             where owner_id = $1 and id = any($2) and uploaded and not deleted`,
            [r.owner_id, r.fabric_ids],
          )
        ).rows
      : [];
    return {
      id: r.id,
      designId: r.owner_id === me ? r.design_id : undefined, // only the owner needs to know which design it is
      name: r.name,
      author: r.author,
      design: r.doc,
      mine: !!me && r.owner_id === me,
      sharedAt: new Date(r.shared_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      fabrics: await Promise.all(
        photos.map(async f => ({ id: f.id, name: f.name, cm: f.cm, url: await store.downloadUrl(f.object_key) })),
      ),
    };
  }

  // Everyone's shared quilts, newest first, 30 at a time (`before` = the last one's updatedAt and id for more);
  // q searches names and authors. Open to all: no sign-in needed.
  app.get(
    '/v1/community',
    {
      config: { public: true, rateLimit: fewer },
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', maxLength: 80 },
            before: { type: 'integer', minimum: 0 },
            beforeId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const { q, before, beforeId } = req.query;
      const args = [];
      const where = ['not hidden'];
      if (q) {
        args.push(`%${q.replace(/[\\%_]/g, m => '\\' + m)}%`);
        where.push(`(name ilike $${args.length} or author ilike $${args.length})`);
      }
      if (before != null) {
        args.push(new Date(before), beforeId || 'ffffffff-ffff-ffff-ffff-ffffffffffff');
        where.push(`(updated_at, id) < ($${args.length - 1}, $${args.length})`);
      }
      const { rows } = await pool.query(
        `select * from shared_designs where ${where.join(' and ')}
         order by updated_at desc, id desc limit ${PAGE + 1}`,
        args,
      );
      const me = req.user?.id || null;
      // at least one quilt, then as many as fit
      let bytes = 0,
        fit = 0;
      for (const r of rows.slice(0, PAGE)) {
        bytes += JSON.stringify(r.doc).length;
        if (fit && bytes > PAGE_BYTES) break;
        fit++;
      }
      return {
        items: await Promise.all(rows.slice(0, fit).map(r => sharedRecord(r, me))),
        more: rows.length > fit,
      };
    },
  );

  // Which of my designs are shared (for the "Shared" tag on My designs).
  app.get('/v1/shared', async (/** @type {Req} */ req) => {
    const { rows } = await pool.query(
      'select id, design_id, updated_at from shared_designs where owner_id = $1 and not hidden order by updated_at desc',
      [req.user.id],
    );
    return { items: rows.map(r => ({ id: r.id, designId: r.design_id, updatedAt: new Date(r.updated_at).getTime() })) };
  });

  // Share one of my designs with the community, or update its shared copy.
  app.put(
    '/v1/shared/:designId',
    {
      config: { rateLimit: fewer },
      schema: {
        params: designIdParam,
        body: {
          type: 'object',
          required: ['name', 'author', 'design'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            author: { type: 'string', minLength: 1, maxLength: 40 },
            design: { type: 'object' },
          },
        },
      },
    },
    async (/** @type {Req} */ req, reply) => {
      const name = req.body.name.trim(),
        author = req.body.author.trim();
      if (!name || !author) throw new ApiError(400, 'bad_request', 'A name and an author name are needed.');
      // the name shown to everyone: not an email address
      if (author.includes('@'))
        throw new ApiError(400, 'author_email', 'The author name is shown to everyone: please don’t use an email.');
      const who = await pool.query('select share_blocked from users where id = $1', [req.user.id]);
      if (who.rows[0]?.share_blocked)
        throw new ApiError(403, 'share_blocked', 'This account can no longer share with the community.');
      const already = await pool.query('select hidden from shared_designs where owner_id = $1 and design_id = $2', [
        req.user.id,
        req.params.designId,
      ]);
      if (already.rows[0]?.hidden)
        throw new ApiError(403, 'taken_down', 'This quilt was taken down from the community.');
      if (!already.rows.length) {
        const have = await pool.query('select count(*)::int as n from shared_designs where owner_id = $1', [
          req.user.id,
        ]);
        if (have.rows[0].n >= config.perPerson.shared)
          throw new ApiError(413, 'storage_full', 'You have shared the most quilts one account can share.');
      }
      if (JSON.stringify(req.body.design).length > config.maxSharedBytes)
        throw new ApiError(413, 'too_large', 'This quilt is too large to share with the community.');
      const r = readQuilt(req.body.design);
      if (!r) throw new ApiError(400, 'not_a_quilt', 'The design could not be read as a quilt.');
      if (r.newer)
        throw new ApiError(
          422,
          'newer_format',
          'The design was made with a newer version of the app than this server knows.',
        );
      // a quilt someone else already shared (a copy from the community, unchanged) can't be shared again as new; the
      // name doesn't count, only the quilt (jsonb equality: the same content, whatever the order of its keys)
      const same = await pool.query(
        'select name, author from shared_designs where owner_id <> $1 and doc = $2::jsonb limit 1',
        [req.user.id, JSON.stringify(r.design)],
      );
      if (same.rows.length) {
        const o = same.rows[0];
        throw new ApiError(
          409,
          'not_changed',
          `This quilt is the same as “${o.name}” by ${o.author}, already shared. Change it to make it yours, then share it.`,
          { sharedAs: { name: o.name, author: o.author } },
        );
      }
      // its photos must be the owner's own, already uploaded
      const ids = photoIds(r.design);
      if (ids.length) {
        const { rows } = await pool.query(
          'select id from fabrics where owner_id = $1 and id = any($2) and uploaded and not deleted',
          [req.user.id, ids],
        );
        const have = new Set(rows.map(x => x.id));
        const missing = ids.filter(i => !have.has(i));
        if (missing.length)
          throw new ApiError(
            409,
            'photos_missing',
            'Some of its fabric photos are not on the server yet: sync first.',
            {
              missing,
            },
          );
      }
      const { rows } = await pool.query(
        `insert into shared_designs (owner_id, design_id, name, author, doc, fabric_ids)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (owner_id, design_id) do update
           set name = excluded.name, author = excluded.author, doc = excluded.doc,
               fabric_ids = excluded.fabric_ids, updated_at = now()
         returning *, (xmax = 0) as created`,
        [req.user.id, req.params.designId, name, author, r.design, ids],
      );
      reply.code(rows[0].created ? 201 : 200);
      return { item: await sharedRecord(rows[0], req.user.id) };
    },
  );

  // Stop sharing one of my designs.
  app.delete('/v1/shared/:designId', { schema: { params: designIdParam } }, async (/** @type {Req} */ req) => {
    // a quilt taken down stays that way: stopping and sharing again must not bring it back
    const { rowCount } = await pool.query(
      'delete from shared_designs where owner_id = $1 and design_id = $2 and not hidden',
      [req.user.id, req.params.designId],
    );
    if (!rowCount) throw new ApiError(404, 'not_found', 'That design is not shared.');
    return { ok: true };
  });

  // Report someone else's shared quilt. Each person counts once; enough of them hide it until it is looked at.
  app.post(
    '/v1/community/:id/report',
    {
      config: { rateLimit: fewer },
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['reason'],
          additionalProperties: false,
          properties: { reason: { type: 'string', enum: ['inappropriate', 'copyright', 'spam', 'other'] } },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const { rows } = await pool.query('select owner_id from shared_designs where id = $1 and not hidden', [
        req.params.id,
      ]);
      if (!rows.length) throw new ApiError(404, 'not_found', 'That quilt is not shared.');
      if (rows[0].owner_id === req.user.id) throw new ApiError(400, 'bad_request', 'This is your own quilt.');
      await pool.query(
        `insert into shared_reports (shared_id, reporter_id, reason) values ($1, $2, $3)
         on conflict (shared_id, reporter_id) do nothing`,
        [req.params.id, req.user.id, req.body.reason],
      );
      const hid = await pool.query(
        `update shared_designs set hidden = true
         where id = $1 and (select count(*) from shared_reports where shared_id = $1) >= $2`,
        [req.params.id, REPORTS_TO_HIDE],
      );
      if (hid.rowCount) req.log.warn({ shared: req.params.id }, 'A shared quilt was hidden after reports.');
      return { ok: true };
    },
  );
}

export { photoIds };
