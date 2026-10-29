// Database migrations: the .sql files in server/migrations, applied in name order, each once, each in its own
// transaction. Run with `npm run migrate -w @quilt/server` (also run by the tests on their own database).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, tx } from './db.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** @param {import('pg').Pool} pool @returns {Promise<string[]>} the migrations applied now */
export async function migrate(pool) {
  await pool.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const done = new Set((await pool.query('select name from schema_migrations')).rows.map(r => r.name));
  const applied = [];
  for (const name of fs
    .readdirSync(DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()) {
    if (done.has(name)) continue;
    const sql = fs.readFileSync(path.join(DIR, name), 'utf8');
    await tx(pool, async c => {
      await c.query(sql);
      await c.query('insert into schema_migrations (name) values ($1)', [name]);
    });
    applied.push(name);
  }
  return applied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(process.env.DATABASE_URL || '');
  migrate(pool)
    .then(a => console.log(a.length ? `Applied: ${a.join(', ')}` : 'Database is up to date'))
    .catch(e => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
