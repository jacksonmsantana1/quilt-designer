// Organizing fabrics in the phone app: folders, and notes on a fabric (how much there is, where it's kept). Whichever
// device changed something last wins, by the time it says it made the change: a person is rarely editing the same folder
// on two phones at once, and nothing here is hard to redo.
import { ApiError } from '../records.js';

/** A request whose params, body and query the route's schema has already checked. @typedef {import('fastify').FastifyRequest & { params: any, body: any, query: any }} Req */

const MAX_FOLDERS = 500,
  MAX_IN_FOLDER = 5000;
const FABRIC_ID = '^[A-Za-z0-9_-]{1,64}$';
const folderId = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } };

const folderRecord = r => ({
  id: r.id,
  name: r.name,
  fabricIds: r.fabric_ids,
  position: r.position,
  deleted: r.deleted,
  updatedAt: new Date(r.updated_at).getTime(),
});
const noteRecord = r => ({
  fabricId: r.fabric_id,
  amount: r.amount,
  place: r.place,
  updatedAt: new Date(r.updated_at).getTime(),
});

/** @param {import('fastify').FastifyInstance} app @param {import('pg').Pool} pool */
export function organizeRoutes(app, pool) {
  // All my folders (deleted ones too, so other devices learn of it) and my notes.
  app.get('/v1/organize', async (/** @type {Req} */ req) => {
    const folders = await pool.query('select * from fabric_folders where owner_id = $1', [req.user.id]),
      notes = await pool.query('select * from fabric_notes where owner_id = $1', [req.user.id]);
    return { folders: folders.rows.map(folderRecord), notes: notes.rows.map(noteRecord) };
  });

  app.put(
    '/v1/folders/:id',
    {
      schema: {
        params: folderId,
        body: {
          type: 'object',
          required: ['name', 'fabricIds', 'position', 'deleted', 'updatedAt'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 60 },
            fabricIds: {
              type: 'array',
              maxItems: MAX_IN_FOLDER,
              items: { type: 'string', pattern: FABRIC_ID },
            },
            position: { type: 'integer', minimum: 0, maximum: 100000 },
            deleted: { type: 'boolean' },
            updatedAt: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const owner = req.user.id,
        { name, fabricIds, position, deleted, updatedAt } = req.body;
      const { rows: count } = await pool.query(
        'select count(*)::int as n from fabric_folders where owner_id = $1 and id <> $2 and not deleted',
        [owner, req.params.id],
      );
      if (!deleted && count[0].n >= MAX_FOLDERS)
        throw new ApiError(413, 'storage_full', 'There is no more room in this account.');
      const { rows } = await pool.query(
        `insert into fabric_folders (owner_id, id, name, fabric_ids, position, deleted, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (owner_id, id) do update
           set name = excluded.name, fabric_ids = excluded.fabric_ids, position = excluded.position,
               deleted = excluded.deleted,
               updated_at = excluded.updated_at
           where fabric_folders.updated_at < excluded.updated_at
         returning *`,
        [owner, req.params.id, name, fabricIds, position, deleted, new Date(updatedAt)],
      );
      // no row back: the server already has something newer, and that's the answer
      if (rows.length) return { record: folderRecord(rows[0]) };
      const newer = await pool.query('select * from fabric_folders where owner_id = $1 and id = $2', [
        owner,
        req.params.id,
      ]);
      return { record: folderRecord(newer.rows[0]) };
    },
  );

  app.put(
    '/v1/fabric-notes/:fabricId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['fabricId'],
          properties: { fabricId: { type: 'string', pattern: FABRIC_ID } },
        },
        body: {
          type: 'object',
          required: ['amount', 'place', 'updatedAt'],
          additionalProperties: false,
          properties: {
            amount: { type: 'string', maxLength: 40 },
            place: { type: 'string', maxLength: 60 },
            updatedAt: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (/** @type {Req} */ req) => {
      const owner = req.user.id,
        { amount, place, updatedAt } = req.body;
      const { rows } = await pool.query(
        `insert into fabric_notes (owner_id, fabric_id, amount, place, updated_at) values ($1, $2, $3, $4, $5)
         on conflict (owner_id, fabric_id) do update
           set amount = excluded.amount, place = excluded.place, updated_at = excluded.updated_at
           where fabric_notes.updated_at < excluded.updated_at
         returning *`,
        [owner, req.params.fabricId, amount, place, new Date(updatedAt)],
      );
      if (rows.length) return { record: noteRecord(rows[0]) };
      const newer = await pool.query('select * from fabric_notes where owner_id = $1 and fabric_id = $2', [
        owner,
        req.params.fabricId,
      ]);
      return { record: noteRecord(newer.rows[0]) };
    },
  );
}
