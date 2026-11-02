// Looking after the community (scripts/moderate.js is the command line for it): which shared quilts were reported,
// taking one down or putting it back, and stopping someone from sharing.

/** @param {import('pg').Pool} pool The reported quilts, most reported first. */
export async function reported(pool) {
  const { rows } = await pool.query(
    `select s.id, s.name, s.author, s.hidden, s.owner_id, count(*)::int as reports,
            array_agg(distinct r.reason) as reasons, max(r.created_at) as last_report
     from shared_reports r join shared_designs s on s.id = r.shared_id
     group by s.id
     order by reports desc, last_report desc`,
  );
  return rows;
}

/** Takes a shared quilt down, or puts it back (its reports are then forgotten). @param {import('pg').Pool} pool */
export async function setHidden(pool, id, hidden) {
  const { rowCount } = await pool.query('update shared_designs set hidden = $2 where id = $1', [id, hidden]);
  if (rowCount && !hidden) await pool.query('delete from shared_reports where shared_id = $1', [id]);
  return rowCount > 0;
}

/**
 * Stops the owner of a shared quilt from sharing and takes down all their quilts, or lets them share again (their
 * quilts stay down until put back one by one). @param {import('pg').Pool} pool
 */
export async function setBlocked(pool, sharedId, blocked) {
  const { rows } = await pool.query('select owner_id from shared_designs where id = $1', [sharedId]);
  if (!rows.length) return false;
  await pool.query('update users set share_blocked = $2 where id = $1', [rows[0].owner_id, blocked]);
  if (blocked) await pool.query('update shared_designs set hidden = true where owner_id = $1', [rows[0].owner_id]);
  return true;
}
