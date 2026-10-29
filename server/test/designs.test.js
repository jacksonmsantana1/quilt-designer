// Saving, conflicts, deleting and reading quilts; the shared format checks; one user can't touch another's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { defaultDesign } from '@quilt/shared/design.js';
import { setup } from './helpers.js';

const { as } = await setup();
const ana = as('ana'),
  ben = as('ben'),
  nobody = as(null);
const fixture = f => JSON.parse(fs.readFileSync(new URL(`../../shared/tests/fixtures/designs/${f}`, import.meta.url)));

test('without the login header: 401', async () => {
  const r = await nobody('GET', '/v1/changes');
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'unauthorized');
  assert.equal((await as('bad name!')('GET', '/v1/changes')).status, 401);
});

test('create, read, change; the save counter goes up', async () => {
  const id = randomUUID();
  let r = await ana('PUT', `/v1/designs/${id}`, { name: 'Star', design: defaultDesign(), baseRev: 0 });
  assert.equal(r.status, 201);
  assert.equal(r.body.record.rev, 1);
  assert.deepEqual(r.body.problems, []);
  r = await ana('PUT', `/v1/designs/${id}`, { name: 'Star 2', design: { ...defaultDesign(), cols: 5 }, baseRev: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.record.rev, 2);
  r = await ana('GET', `/v1/designs/${id}`);
  assert.equal(r.body.name, 'Star 2');
  assert.equal(r.body.design.v, 1);
});

test('two devices: the second save based on an old copy gets 409 and the server copy', async () => {
  const id = randomUUID();
  await ana('PUT', `/v1/designs/${id}`, { name: 'A', design: defaultDesign(), baseRev: 0 });
  const laptop = await ana('PUT', `/v1/designs/${id}`, { name: 'from laptop', design: defaultDesign(), baseRev: 1 });
  assert.equal(laptop.status, 200);
  const phone = await ana('PUT', `/v1/designs/${id}`, { name: 'from phone', design: defaultDesign(), baseRev: 1 });
  assert.equal(phone.status, 409);
  assert.equal(phone.body.error, 'conflict');
  assert.equal(phone.body.server.name, 'from laptop');
  assert.equal(phone.body.server.rev, 2);
  // saving a "new" design whose id already exists is a conflict too
  assert.equal((await ana('PUT', `/v1/designs/${id}`, { name: 'x', design: defaultDesign(), baseRev: 0 })).status, 409);
});

test('delete leaves a marker; a stale delete is a conflict; deleting twice is harmless', async () => {
  const id = randomUUID();
  await ana('PUT', `/v1/designs/${id}`, { name: 'Gone', design: defaultDesign(), baseRev: 0 });
  assert.equal((await ana('DELETE', `/v1/designs/${id}?baseRev=5`)).status, 409);
  const r = await ana('DELETE', `/v1/designs/${id}?baseRev=1`);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.record.deleted, r.body.record.design, r.body.record.rev], [true, null, 2]);
  assert.equal((await ana('DELETE', `/v1/designs/${id}?baseRev=2`)).body.record.rev, 2);
  // saving it again on top of the marker brings it back
  const back = await ana('PUT', `/v1/designs/${id}`, { name: 'Back', design: defaultDesign(), baseRev: 2 });
  assert.deepEqual([back.status, back.body.record.deleted, back.body.record.rev], [200, false, 3]);
});

test('the format checks are the app’s: old saves upgraded, damaged ones repaired and reported', async () => {
  for (const f of [
    'v0-before-block-sizes.json',
    'v0-every-feature.json',
    'v0-medallion-sampler.json',
    'v0-photo-medallion.json',
  ]) {
    const r = await ana('PUT', `/v1/designs/${randomUUID()}`, { name: f, design: fixture(f), baseRev: 0 });
    assert.equal(r.status, 201, f);
    assert.equal(r.body.record.design.v, 1, f);
    assert.deepEqual(r.body.problems, [], f);
  }
  const broken = await ana('PUT', `/v1/designs/${randomUUID()}`, {
    name: 'b',
    design: fixture('broken.json'),
    baseRev: 0,
  });
  assert.equal(broken.status, 201);
  assert.equal(broken.body.problems.length, 11);
  assert.equal(broken.body.record.design.blocks[0].pattern, 'plain');
  const newer = await ana('PUT', `/v1/designs/${randomUUID()}`, {
    name: 'n',
    design: fixture('newer.json'),
    baseRev: 0,
  });
  assert.deepEqual([newer.status, newer.body.error], [422, 'newer_format']);
  const junk = await ana('PUT', `/v1/designs/${randomUUID()}`, { name: 'j', design: { hello: 1 }, baseRev: 0 });
  assert.deepEqual([junk.status, junk.body.error], [400, 'not_a_quilt']);
});

test('bad requests are refused before any database work', async () => {
  const id = randomUUID();
  const cases = [
    ['PUT', '/v1/designs/not-a-uuid', { name: 'x', design: defaultDesign(), baseRev: 0 }],
    ['PUT', `/v1/designs/${id}`, { name: '', design: defaultDesign(), baseRev: 0 }],
    ['PUT', `/v1/designs/${id}`, { name: 'x'.repeat(81), design: defaultDesign(), baseRev: 0 }],
    ['PUT', `/v1/designs/${id}`, { name: 'x', design: defaultDesign(), baseRev: -1 }],
    ['PUT', `/v1/designs/${id}`, { name: 'x', design: defaultDesign() }],
    ['PUT', `/v1/designs/${id}`, { name: 'x', design: defaultDesign(), baseRev: 0, owner: 'someone' }],
    ['DELETE', `/v1/designs/${id}`],
  ];
  for (const [m, u, p] of cases) {
    const r = await ana(m, u, p);
    assert.equal(r.status, 400, `${m} ${u} ${JSON.stringify(p)?.slice(0, 60)}`);
  }
  const huge = { ...defaultDesign(), padding: 'x'.repeat(3 * 1024 * 1024) };
  assert.equal((await ana('PUT', `/v1/designs/${id}`, { name: 'x', design: huge, baseRev: 0 })).status, 413);
});

test('one user cannot read, change or delete another’s design', async () => {
  const id = randomUUID();
  await ana('PUT', `/v1/designs/${id}`, { name: 'Ana’s', design: defaultDesign(), baseRev: 0 });
  assert.equal((await ben('GET', `/v1/designs/${id}`)).status, 404);
  assert.equal(
    (await ben('PUT', `/v1/designs/${id}`, { name: 'mine now', design: defaultDesign(), baseRev: 1 })).status,
    404,
  );
  assert.equal((await ben('DELETE', `/v1/designs/${id}?baseRev=1`)).status, 404);
  assert.equal((await ana('GET', `/v1/designs/${id}`)).body.name, 'Ana’s');
});

test('unknown addresses and the health check', async () => {
  assert.equal((await ana('GET', '/v1/nothing')).status, 404);
  const h = await nobody('GET', '/health');
  assert.deepEqual([h.status, h.body.ok], [200, true]);
});
