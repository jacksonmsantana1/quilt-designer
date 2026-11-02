// What keeps one person from running up the bills or overloading the server: requests a minute, how much an account
// can keep, how large a shared quilt and a page of the community can be; and that the server keeps no drawn blocks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign } from '@quilt/shared/design.js';
import { PATTERNS } from '@quilt/shared/patterns.js';
import { drawnKey } from '@quilt/shared/drawn-blocks.js';
import { setup } from './helpers.js';

const drawn = (n, label = 'Mine') => {
  const def = { label, n: 2, rows: `${n} 0\n0 0` };
  return { ...defaultDesign(), drawn: { [drawnKey(def)]: def } };
};
const PHOTO = (bytes, type = 'image/png') => ({ name: 'Rose', cm: 15, type, bytes });
const photoId = i => 'f' + String(i).padStart(24, '0');

test('too many requests in a minute are refused, per person; the health check is not counted', async () => {
  const { as, app } = await setup({ RATE_LIMIT_PER_MINUTE: '3' });
  const ana = as('rana'),
    ben = as('rben');
  for (let i = 0; i < 3; i++) assert.equal((await ana('GET', '/v1/changes?since=0')).status, 200);
  const over = await ana('GET', '/v1/changes?since=0');
  assert.equal(over.status, 429);
  assert.equal(over.body.error, 'rate_limited');
  assert.equal((await ben('GET', '/v1/changes?since=0')).status, 200, 'someone else is not affected');
  for (let i = 0; i < 5; i++) assert.equal((await app.inject({ url: '/health' })).statusCode, 200);
});

test('the public list has its own, lower limit, by address, and the proxy header names the address', async () => {
  const { app } = await setup({ RATE_LIMIT_PER_MINUTE: '10', CLIENT_IP_HEADER: 'Fly-Client-IP' });
  const ask = ip => app.inject({ url: '/v1/community', headers: { 'fly-client-ip': ip } });
  assert.equal((await ask('203.0.113.1')).statusCode, 200);
  assert.equal((await ask('203.0.113.1')).statusCode, 429);
  assert.equal((await ask('203.0.113.2')).statusCode, 200);
});

test('one account can keep so many photos: refused beyond it, and a deleted or replaced one makes room', async () => {
  const { as } = await setup({ MAX_PHOTO_MB_PER_PERSON: '1' });
  const ana = as('qana');
  const half = 600 * 1024;
  assert.equal((await ana('POST', `/v1/fabrics/${photoId(1)}/upload`, PHOTO(half))).status, 200);
  const full = await ana('POST', `/v1/fabrics/${photoId(2)}/upload`, PHOTO(half));
  assert.equal(full.status, 413);
  assert.equal(full.body.error, 'storage_full');
  // asking again for the same photo isn't counted twice
  assert.equal((await ana('POST', `/v1/fabrics/${photoId(1)}/upload`, PHOTO(half))).status, 200);
  assert.equal((await as('qben')('POST', `/v1/fabrics/${photoId(2)}/upload`, PHOTO(half))).status, 200);
});

test('one account can keep so many designs; deleting one makes room, and changing one is always allowed', async () => {
  const { as } = await setup({ MAX_DESIGNS_PER_PERSON: '1' });
  const ana = as('dana');
  const save = (id, baseRev = 0) => ana('PUT', `/v1/designs/${id}`, { name: 'Q', design: defaultDesign(), baseRev });
  assert.equal((await save('one')).status, 201);
  assert.equal((await save('one', 1)).status, 200);
  const r = await save('two');
  assert.equal(r.status, 413);
  assert.equal(r.body.error, 'storage_full');
  assert.equal((await ana('DELETE', '/v1/designs/one?baseRev=2')).status, 200);
  assert.equal((await save('two')).status, 201);
});

test('a quilt too large is not shared, and one account can share so many', async () => {
  const { as } = await setup({ MAX_SHARED_PER_PERSON: '1' });
  const ana = as('sana');
  const share = (id, design) => ana('PUT', `/v1/shared/${id}`, { name: 'Q', author: 'Ana', design });
  const big = { ...defaultDesign(), padding: 'x'.repeat(600 * 1024) };
  const large = await share('big', big);
  assert.equal(large.status, 413);
  assert.equal(large.body.error, 'too_large');
  assert.equal((await share('one', defaultDesign())).status, 201);
  assert.equal((await share('one', defaultDesign())).status, 200, 'updating it is not one more');
  assert.equal((await share('two', drawn(1))).status, 413);
});

test('a page of the community stops at a size, and the next one brings the rest', async () => {
  const { as, pool } = await setup();
  const ana = as('pana');
  await ana('PUT', '/v1/shared/seed', { name: 'Seed', author: 'Ana', design: defaultDesign() });
  const { rows } = await pool.query('select owner_id from shared_designs');
  // twelve quilts of 400 KB each, straight into the database: more than one page can hold
  const doc = JSON.stringify({ ...defaultDesign(), padding: 'x'.repeat(400 * 1024) });
  for (let i = 0; i < 12; i++)
    await pool.query(
      `insert into shared_designs (owner_id, design_id, name, author, doc) values ($1, $2, 'Big', 'Ana', $3::jsonb)`,
      [rows[0].owner_id, `big${i}`, doc],
    );
  const first = await ana('GET', '/v1/community');
  assert.equal(first.status, 200);
  assert.ok(first.body.items.length < 13 && first.body.items.length >= 1);
  assert.ok(JSON.stringify(first.body).length < 5 * 1024 * 1024);
  assert.equal(first.body.more, true);
  const last = first.body.items[first.body.items.length - 1];
  const next = await ana('GET', `/v1/community?before=${last.updatedAt}&beforeId=${last.id}`);
  assert.ok(next.body.items.length >= 1);
});

test('the server checks drawn blocks without keeping them', async () => {
  const { as } = await setup();
  const ana = as('mana');
  const known = () => Object.values(PATTERNS).filter(p => p.drawn).length;
  const before = known();
  for (let i = 1; i <= 3; i++) {
    const r = await ana('PUT', `/v1/designs/d${i}`, { name: 'Q', design: drawn(i), baseRev: 0 });
    assert.equal(r.status, 201);
    const back = await ana('GET', `/v1/designs/d${i}`);
    assert.equal(Object.keys(back.body.design.drawn).length, 1, 'the quilt keeps its drawn block');
  }
  assert.equal((await ana('PUT', '/v1/shared/d1', { name: 'Q', author: 'Ana', design: drawn(1) })).status, 201);
  assert.equal(known(), before);
});
