// Taking quilts down: people report them, enough reports hide them, and someone looks at them afterwards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign } from '@quilt/shared/design.js';
import { reported, setBlocked, setHidden } from '../src/moderation.js';
import { setup } from './helpers.js';

const { as, pool } = await setup();
const owner = as('ownr'),
  nobody = as(null);
/** The default quilt, turned so each is a different quilt (the same one can't be shared twice by two people). */
const quilt = n => {
  const d = defaultDesign();
  return { ...d, blocks: d.blocks.map((b, i) => (i === 0 ? { ...b, rot: n % 4 } : b)) };
};
const share = (who, id, n) => who('PUT', `/v1/shared/${id}`, { name: id, author: 'Ana', design: quilt(n) });
const listed = async () => (await nobody('GET', '/v1/community')).body.items.map(i => i.name);
const report = (user, id, reason = 'spam') => as(user)('POST', `/v1/community/${id}/report`, { reason });

test('reporting needs a sign-in, a real reason, and someone else’s quilt; a person counts once', async () => {
  const { body } = await share(owner, 'once', 1);
  const id = body.item.id;
  assert.equal((await nobody('POST', `/v1/community/${id}/report`, { reason: 'spam' })).status, 401);
  assert.equal((await report('r1', id, 'because')).status, 400);
  assert.equal((await report('ownr', id)).status, 400);
  assert.equal((await report('r1', '00000000-0000-4000-8000-000000000000')).status, 404);
  for (let i = 0; i < 5; i++) assert.equal((await report('r1', id)).status, 200);
  assert.ok((await listed()).includes('once'), 'one person reporting five times is one report');
  const r = (await reported(pool)).find(x => x.id === id);
  assert.equal(r.reports, 1);
  assert.deepEqual(r.reasons, ['spam']);
  assert.equal((await owner('DELETE', '/v1/shared/once')).status, 200);
});

test('three people reporting hide a quilt, and stopping and sharing again does not bring it back', async () => {
  const { body } = await share(owner, 'bad', 2);
  const id = body.item.id;
  await report('r1', id);
  await report('r2', id, 'copyright');
  assert.ok((await listed()).includes('bad'));
  await report('r3', id, 'inappropriate');
  assert.ok(!(await listed()).includes('bad'), 'hidden from everyone');
  assert.equal((await report('r4', id)).status, 404);
  const mine = await owner('GET', '/v1/shared');
  assert.ok(!mine.body.items.some(i => i.designId === 'bad'), 'not listed as shared for its owner either');
  assert.equal((await owner('DELETE', '/v1/shared/bad')).status, 404);
  const again = await share(owner, 'bad', 2);
  assert.equal(again.status, 403);
  assert.equal(again.body.error, 'taken_down');
  // someone looks at it and it was fine: it comes back with a clean slate
  assert.equal(await setHidden(pool, id, false), true);
  assert.ok((await listed()).includes('bad'));
  assert.ok(!(await reported(pool)).some(x => x.id === id));
  assert.equal(await setHidden(pool, '00000000-0000-4000-8000-000000000000', true), false);
});

test('someone can be stopped from sharing, and can be let back', async () => {
  const mal = as('malo');
  const { body } = await share(mal, 'm1', 3);
  await share(mal, 'm2', 0);
  assert.equal(await setBlocked(pool, body.item.id, true), true);
  const names = await listed();
  assert.ok(!names.includes('m1') && !names.includes('m2'), 'all their quilts go down');
  const r = await share(mal, 'm3', 1);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'share_blocked');
  assert.equal(await setBlocked(pool, body.item.id, false), true);
  assert.notEqual((await share(mal, 'm3', 1)).body.error, 'share_blocked');
});
