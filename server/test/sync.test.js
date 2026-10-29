// /v1/changes: what a second device gets, in order, page by page, including deletions; only the caller's data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { defaultDesign } from '@quilt/shared/design.js';
import { setup } from './helpers.js';

const { as, pool } = await setup();
const ana = as('ana'),
  ben = as('ben');
const save = (who, id, name, baseRev = 0) =>
  who('PUT', `/v1/designs/${id}`, { name, design: defaultDesign(), baseRev });

test('a new device gets everything; later it gets only what changed, deletions too', async () => {
  const a = randomUUID(),
    b = randomUUID();
  await save(ana, a, 'one');
  await save(ana, b, 'two');
  let r = await ana('GET', '/v1/changes?since=0');
  assert.deepEqual(
    r.body.changes.map(c => c.name),
    ['one', 'two'],
  );
  assert.equal(r.body.more, false);
  const since = r.body.since;
  await save(ana, a, 'one, edited', 1);
  await ana('DELETE', `/v1/designs/${b}?baseRev=1`);
  r = await ana('GET', `/v1/changes?since=${since}`);
  assert.deepEqual(
    r.body.changes.map(c => [c.name, c.rev, c.deleted]),
    [
      ['one, edited', 2, false],
      ['two', 2, true],
    ],
  );
  // nothing new: the same since comes back
  const again = await ana('GET', `/v1/changes?since=${r.body.since}`);
  assert.deepEqual([again.body.changes, again.body.since], [[], r.body.since]);
});

test('pages: `more` until everything is read, and every change exactly once', async () => {
  const ids = Array.from({ length: 7 }, () => randomUUID());
  const start = (await ben('GET', '/v1/changes?since=0')).body.since;
  for (const [i, id] of ids.entries()) await save(ben, id, `q${i}`);
  const got = [];
  let since = start,
    more = true,
    pages = 0;
  while (more) {
    const r = await ben('GET', `/v1/changes?since=${since}&limit=3`);
    got.push(...r.body.changes.map(c => c.name));
    ({ since, more } = r.body);
    pages++;
  }
  assert.deepEqual(
    got,
    ids.map((_, i) => `q${i}`),
  );
  assert.equal(pages, 3);
});

test('each user sees only their own changes', async () => {
  const r = await as('carla')('GET', '/v1/changes?since=0');
  assert.deepEqual(r.body.changes, []);
  const anaNames = (await ana('GET', '/v1/changes?since=0')).body.changes.map(c => c.name);
  assert.ok(!anaNames.some(n => /^q\d$/.test(n)));
});

test('writes for one user are numbered in the order they commit, even when they race', async () => {
  const ids = Array.from({ length: 12 }, () => randomUUID());
  const before = (await as('dan')('GET', '/v1/changes?since=0')).body.since;
  await Promise.all(ids.map((id, i) => save(as('dan'), id, `r${i}`)));
  const r = await as('dan')('GET', `/v1/changes?since=${before}&limit=100`);
  assert.equal(r.body.changes.length, 12);
  const seqs = r.body.changes.map(c => c.seq);
  assert.deepEqual(
    seqs,
    [...seqs].sort((x, y) => x - y),
  );
  assert.equal(new Set(seqs).size, 12);
  // and the counter is shared by all users, so it only grows
  const { rows } = await pool.query('select max(seq) as m from designs');
  assert.ok(rows[0].m >= Math.max(...seqs));
});

test('bad since or limit', async () => {
  assert.equal((await ana('GET', '/v1/changes?since=-1')).status, 400);
  assert.equal((await ana('GET', '/v1/changes?limit=0')).status, 400);
  assert.equal((await ana('GET', '/v1/changes?limit=501')).status, 400);
});
