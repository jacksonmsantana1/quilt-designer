// Development photo storage (STORAGE=local): signed links served by the API itself; never in production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { localStore } from '../src/objects.js';
import { fabricId } from '../src/routes/fabrics.js';
import { setup } from './helpers.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quilt-photos-'));
const { app, as } = await setup({}, () => localStore(dir, 'http://api.test'));
const ana = as('ana');
const img = new Uint8Array(Array.from({ length: 1500 }, (_, i) => (i * 5) % 256));
const id = fabricId(img);
const path0 = url => {
  const u = new URL(url);
  return u.pathname + u.search;
};
const send = (url, body, type = 'image/png') =>
  app.inject({ method: 'PUT', url: path0(url), payload: Buffer.from(body), headers: { 'content-type': type } });

test('settings: local storage by default in development, refused in production', () => {
  const DB = { DATABASE_URL: 'postgres://x/y' };
  assert.equal(loadConfig(DB).storage, 'local');
  assert.equal(loadConfig({ ...DB, S3_ENDPOINT: 'http://localhost:9000' }).storage, 's3');
  assert.equal(loadConfig({ ...DB, NODE_ENV: 'production' }).storage, 's3');
  assert.throws(
    () => loadConfig({ ...DB, NODE_ENV: 'production', STORAGE: 'local' }),
    /cannot be used with NODE_ENV=production/,
  );
});

test('the whole upload through the API’s own links; the link only takes that type and size', async () => {
  const up = await ana('POST', `/v1/fabrics/${id}/upload`, { name: 'P', cm: 10, type: 'image/png', bytes: img.length });
  assert.match(up.body.url, /^http:\/\/api\.test\/dev-files\/uploads\//);
  assert.equal((await send(up.body.url, img.subarray(0, 10))).statusCode, 403); // other size
  assert.equal((await send(up.body.url, img, 'image/jpeg')).statusCode, 403); // other type
  assert.equal((await send(up.body.url.replace(/sig=[0-9a-f]/, 'sig=0'), img)).statusCode, 403); // tampered
  assert.equal((await send(up.body.url, img)).statusCode, 200);
  assert.equal((await ana('POST', `/v1/fabrics/${id}/done`)).status, 200);
  const got = await ana('GET', `/v1/fabrics/${id}`);
  const file = await app.inject({ method: 'GET', url: path0(got.body.url) });
  assert.equal(file.statusCode, 200);
  assert.deepEqual(new Uint8Array(file.rawPayload), img);
  // the file is in the folder, under the person's id, and the upload copy is gone
  const all = fs.readdirSync(dir, { recursive: true }).map(String);
  assert.ok(all.some(f => f.endsWith(id)));
  assert.ok(!all.some(f => f.includes('uploads/') && f.includes(id + '-')));
});

test('links without a valid signature, and paths outside the folder, are refused', async () => {
  assert.equal((await app.inject({ method: 'GET', url: `/dev-files/fabrics/x/${id}` })).statusCode, 403);
  const store = localStore(dir, 'http://api.test');
  await assert.rejects(() => store.get('../../etc/passwd'), /bad key/);
});
