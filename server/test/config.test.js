// Settings: the stand-in login can never be on in production; required values; the S3 links are signed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { s3Store } from '../src/objects.js';
import { setup } from './helpers.js';

const DB = { DATABASE_URL: 'postgres://x/y' };

test('development and tests use the stand-in login by default', () => {
  assert.equal(loadConfig({ ...DB }).auth, 'dev');
  assert.equal(loadConfig({ ...DB, NODE_ENV: 'test' }).auth, 'dev');
});

test('production refuses the stand-in login and defaults to none', () => {
  assert.throws(
    () => loadConfig({ ...DB, NODE_ENV: 'production', AUTH_MODE: 'dev' }),
    /cannot be used with NODE_ENV=production/,
  );
  assert.equal(loadConfig({ ...DB, NODE_ENV: 'production' }).auth, 'none');
});

test('missing or bad settings stop the start with a clear message', () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL is not set/);
  assert.throws(() => loadConfig({ ...DB, NODE_ENV: 'staging' }), /NODE_ENV must be/);
  assert.throws(() => loadConfig({ ...DB, AUTH_MODE: 'open' }), /AUTH_MODE must be/);
});

test('with login off, every /v1 request is 401 (health still answers)', async () => {
  const { as } = await setup({ AUTH_MODE: 'none' });
  const r = await as('ana')('GET', '/v1/changes');
  assert.deepEqual([r.status, r.body.error], [401, 'unauthorized']);
  assert.equal((await as(null)('GET', '/health')).status, 200);
});

test('S3 upload links are signed for the exact type and size (made offline, no storage needed)', async () => {
  const store = s3Store({
    endpoint: 'http://localhost:9000',
    region: 'auto',
    bucket: 'quilt-fabrics',
    accessKeyId: 'dev',
    secretAccessKey: 'devsecret',
    forcePathStyle: true,
  });
  const { url, headers } = await store.uploadUrl('fabrics/u/fabc', { type: 'image/png', bytes: 1234 });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'http://localhost:9000/quilt-fabrics/fabrics/u/fabc');
  assert.equal(u.searchParams.get('X-Amz-Expires'), '600');
  assert.match(u.searchParams.get('X-Amz-SignedHeaders'), /content-length/);
  assert.match(u.searchParams.get('X-Amz-SignedHeaders'), /content-type/);
  assert.ok(u.searchParams.get('X-Amz-Signature'));
  assert.equal(headers['content-type'], 'image/png');
});

test('migrations run once', async () => {
  const { pool } = await setup();
  const { migrate } = await import('../src/migrate.js');
  assert.deepEqual(await migrate(pool), []);
  const { rows } = await pool.query("select extname from pg_extension where extname = 'vector'");
  assert.equal(rows.length, 1); // ready for "fabrics like this one"
});
