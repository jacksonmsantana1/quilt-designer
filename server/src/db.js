// The PostgreSQL connection pool and a transaction helper.
import pg from 'pg';

// bigint columns (seq) come back as JS numbers: change numbers stay far below 2^53
pg.types.setTypeParser(20, v => Number(v));

/** @param {string} url */
export function createPool(url) {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  // an idle connection the database closes (restart, failover) must not crash the server: the pool replaces it
  pool.on('error', e => console.error('database connection lost:', e.message));
  return pool;
}

/**
 * Runs fn in a transaction: committed if it returns, rolled back if it throws.
 * @template T @param {pg.Pool} pool @param {(c: pg.PoolClient) => Promise<T>} fn @returns {Promise<T>}
 */
export async function tx(pool, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Takes a lock on one user's data until the transaction ends. Every write for a user takes it first, so their
 * writes happen one at a time and their change numbers (seq) are committed in order: a device that has synced up
 * to change N can never miss a change below N that commits later.
 * @param {pg.PoolClient} c @param {string} ownerId
 */
export async function lockOwner(c, ownerId) {
  await c.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerId]);
}
