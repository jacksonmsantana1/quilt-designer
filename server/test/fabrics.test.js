// Fabric photos: upload link, the hash check, "already have it", listing in changes, delete, isolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { fabricId } from '../src/routes/fabrics.js';

const { as, store } = await setup();
const ana = as('ana'),
  ben = as('ben');
const image = n => new Uint8Array(Array.from({ length: 2000 }, (_, i) => (i * 7 + n) % 256));
const meta = (bytes, extra = {}) => ({ name: 'Paisley', cm: 15, type: 'image/jpeg', bytes: bytes.length, ...extra });
const keyOf = url => url.replace('memory://', '');

test('upload: link, the browser puts the image, done checks it and lists it', async () => {
  const img = image(1),
    id = fabricId(img);
  let r = await ana('POST', `/v1/fabrics/${id}/upload`, meta(img));
  assert.equal(r.body.status, 'upload');
  assert.equal(r.body.headers['content-type'], 'image/jpeg');
  // not listed before it is done
  assert.equal((await ana('GET', `/v1/fabrics/${id}`)).status, 404);
  assert.equal((await ana('POST', `/v1/fabrics/${id}/done`)).status, 409); // nothing arrived yet
  store.put(keyOf(r.body.url), img);
  r = await ana('POST', `/v1/fabrics/${id}/done`);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.record.rev, r.body.record.name, r.body.record.cm], [1, 'Paisley', 15]);
  const upKey = keyOf((await ana('POST', `/v1/fabrics/${id}/upload`, meta(img))).body.url ?? 'none');
  assert.equal(upKey, 'none'); // already have it: no new link
  r = await ana('GET', `/v1/fabrics/${id}`);
  assert.match(keyOf(r.body.url), new RegExp(`^fabrics/[0-9a-f-]{36}/${id}$`));
  assert.ok(!store.keys().some(k => k.startsWith('uploads/'))); // the upload was moved to its lasting place
  const ch = await ana('GET', '/v1/changes?since=0');
  assert.deepEqual(
    ch.body.changes.map(c => [c.kind, c.id]),
    [['fabric', id]],
  );
});

test('the same photo again: "have", no second upload', async () => {
  const img = image(1),
    id = fabricId(img);
  const r = await ana('POST', `/v1/fabrics/${id}/upload`, meta(img));
  assert.equal(r.body.status, 'have');
  assert.equal(r.body.record.id, id);
});

test('an image that is not the one the id names is refused and removed', async () => {
  const img = image(2),
    id = fabricId(img);
  const r = await ana('POST', `/v1/fabrics/${id}/upload`, meta(img));
  const other = image(3);
  store.put(keyOf(r.body.url), other.subarray(0, img.length));
  const done = await ana('POST', `/v1/fabrics/${id}/done`);
  assert.deepEqual([done.status, done.body.error], [422, 'wrong_image']);
  assert.ok(!store.keys().includes(keyOf(r.body.url)));
  // the right image afterwards is fine
  store.put(keyOf(r.body.url), img);
  assert.equal((await ana('POST', `/v1/fabrics/${id}/done`)).status, 200);
});

test('delete: marker in changes, image removed; a new upload brings it back', async () => {
  const img = image(4),
    id = fabricId(img);
  const up = await ana('POST', `/v1/fabrics/${id}/upload`, meta(img));
  store.put(keyOf(up.body.url), img);
  await ana('POST', `/v1/fabrics/${id}/done`);
  const since = (await ana('GET', '/v1/changes?since=0')).body.since;
  assert.equal((await ana('DELETE', `/v1/fabrics/${id}?baseRev=9`)).status, 409);
  const del = await ana('DELETE', `/v1/fabrics/${id}?baseRev=1`);
  assert.deepEqual([del.status, del.body.record.deleted, del.body.record.rev], [200, true, 2]);
  assert.ok(!store.keys().some(k => k.endsWith('/' + id) && k.startsWith('fabrics/'))); // the image is gone
  const ch = await ana('GET', `/v1/changes?since=${since}`);
  assert.deepEqual(
    ch.body.changes.map(c => [c.id, c.deleted]),
    [[id, true]],
  );
  const again = await ana('POST', `/v1/fabrics/${id}/upload`, meta(img));
  assert.equal(again.body.status, 'upload');
});

test('an old upload link cannot change a photo once it is checked', async () => {
  const img = image(6),
    id = fabricId(img);
  const up = await ana('POST', `/v1/fabrics/${id}/upload`, meta(img));
  store.put(keyOf(up.body.url), img);
  await ana('POST', `/v1/fabrics/${id}/done`);
  store.put(keyOf(up.body.url), image(7)); // someone uses the link again
  const kept = await store.get(keyOf((await ana('GET', `/v1/fabrics/${id}`)).body.url));
  assert.equal(fabricId(kept), id);
});

test('each user has their own photos', async () => {
  const img = image(1),
    id = fabricId(img);
  assert.equal((await ben('GET', `/v1/fabrics/${id}`)).status, 404);
  assert.equal((await ben('DELETE', `/v1/fabrics/${id}?baseRev=1`)).status, 404);
  // Ben uploading the same picture gets his own copy (and his own upload)
  const r = await ben('POST', `/v1/fabrics/${id}/upload`, meta(img));
  assert.equal(r.body.status, 'upload');
  assert.notEqual(keyOf(r.body.url), (await ana('GET', `/v1/fabrics/${id}`)).body.url.replace('memory://', ''));
});

test('bad uploads are refused', async () => {
  const img = image(5),
    id = fabricId(img);
  const bad = [
    ['/v1/fabrics/h0123456789abcdef/upload', meta(img)], // the simple hash: only sha-256 ids are accepted
    [`/v1/fabrics/${id}/upload`, meta(img, { type: 'image/gif' })],
    [`/v1/fabrics/${id}/upload`, meta(img, { bytes: 16 * 1024 * 1024 })],
    [`/v1/fabrics/${id}/upload`, meta(img, { cm: 0 })],
    [`/v1/fabrics/${id}/upload`, { name: 'x' }],
  ];
  for (const [url, body] of bad) assert.equal((await ana('POST', url, body)).status, 400, JSON.stringify(body));
});
