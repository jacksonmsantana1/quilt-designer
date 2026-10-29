// Test set-up: a fresh PostgreSQL database per test file (made from TEST_DATABASE_URL's server, dropped at the
// end), migrated, and the API on it with in-memory photo storage. Requests go through app.inject: no network.
import { after } from 'node:test';
import pg from 'pg';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { migrate } from '../src/migrate.js';
import { memoryStore } from '../src/objects.js';
import { buildApp } from '../src/app.js';

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5433/postgres?host=/tmp';

/**
 * @param {Record<string, string>} [env] extra settings
 * @param {(config: any) => any} [makeStore] photo storage (in memory by default)
 */
export async function setup(env = {}, makeStore = () => memoryStore()) {
  const name = `quilt_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  const url = new URL(ADMIN_URL);
  url.pathname = '/' + name;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: url.toString(), ...env });
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  const store = makeStore(config);
  const app = await buildApp({ config, pool, store });
  after(async () => {
    await app.close();
    await pool.end();
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  });
  /** a request as one user (X-Dev-User), returning { status, body } */
  const as = user => async (method, url, payload) => {
    const r = await app.inject({ method, url, payload, headers: user ? { 'x-dev-user': user } : {} });
    return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null };
  };
  return { app, pool, store, config, as };
}
