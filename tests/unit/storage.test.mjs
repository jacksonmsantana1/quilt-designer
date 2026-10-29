// storage/repo.js and storage/migrate.js, on the in-memory database (the browser tests cover IndexedDB itself).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { memoryDb } from '../../src/storage/idb.js';
import { migrateLocalStorage } from '../../src/storage/migrate.js';
import * as repo from '../../src/storage/repo.js';

const fixture = f => fs.readFileSync(new URL(`../fixtures/designs/${f}`, import.meta.url), 'utf8');
/** a localStorage stand-in */
function fakeStorage(o) {
  const m = new Map(Object.entries(o));
  return {
    getItem: k => m.get(k) ?? null,
    key: i => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}
const OLD = {
  'quilt-designer.v1': fixture('v0-before-block-sizes.json'),
  'quilt-mydesigns.v1': JSON.stringify([
    { id: 'a', name: 'Good', d: fixture('v0-every-feature.json'), created: 5, updated: 6 },
    { id: 'b', name: 'Damaged', d: fixture('broken.json'), created: 7, updated: 8 },
    { name: 'no id' },
  ]),
  'quilt-mydesigns-current.v1': 'a',
  'quilt-timeline.v1:a': JSON.stringify({ steps: [{ id: 1, d: '{}' }], i: 0, seq: 1 }),
  'quilt-timeline.v1': JSON.stringify({
    steps: [
      { id: 1, d: '{}' },
      { id: 2, d: '{}' },
    ],
    i: 1,
    seq: 2,
  }), // oldest form
  'quilt-photo-seeded.v1': '1',
};

test('migration: designs upgraded, damaged ones kept as they were, timelines and flags moved', () => {
  const out = migrateLocalStorage(fakeStorage(OLD));
  assert.deepEqual(
    out.designs.map(d => d.id),
    ['a', 'b'],
  );
  assert.equal(out.designs[0].design.v, 1);
  assert.equal(out.designs[0].createdAt, 5);
  assert.equal(out.designs[1].design.blocks[0].pattern, 'no-such-pattern');
  assert.equal(out.session.find(([k]) => k === 'current')[1].blockMm, Math.round(2290 / 3));
  assert.deepEqual(
    out.session.find(([k]) => k === 'mineCur'),
    ['mineCur', 'a'],
  );
  assert.deepEqual(
    out.session.find(([k]) => k === 'photo-seeded'),
    ['photo-seeded', true],
  );
  // 'a' has its own timeline, so the bare one (which belonged to the current design, 'a') is not used
  assert.deepEqual(
    out.timelines.map(t => [t.key, t.steps.length]),
    [['a', 1]],
  );
});

test('migration of an empty storage gives nothing', () => {
  assert.deepEqual(migrateLocalStorage(fakeStorage({})), { designs: [], timelines: [], session: [] });
});

test('opening moves the old data once, then keeps the stores', async () => {
  const db = memoryDb();
  const r = await repo.openStorage({ db, legacy: fakeStorage(OLD) });
  assert.equal(r.migrated, true);
  assert.equal(repo.designs.list().length, 2);
  repo.designs.remove('b');
  await repo.flush();
  // a second start (same database): no second move, so the deletion stays
  const again = await repo.openStorage({ db, legacy: fakeStorage(OLD) });
  assert.equal(again.migrated, false);
  assert.deepEqual(
    repo.designs.list().map(d => d.id),
    ['a'],
  );
  const stored = (await db.getAll('designs')).find(d => d.id === 'b');
  assert.equal(stored.deleted, true); // kept as a marker for a server
});

test('design records: ids, save counter, upload flag', async () => {
  await repo.openStorage({ db: memoryDb(), legacy: null });
  const id = repo.designs.newId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const a = repo.designs.save({ id, name: 'Q', design: { cols: 1 } });
  assert.equal(a.rev, 1);
  assert.equal(a.dirty, true);
  const b = repo.designs.save({ id, name: 'Q2' });
  assert.equal(b.rev, 2);
  assert.deepEqual(b.design, { cols: 1 }); // a change keeps the other fields
  assert.equal(b.createdAt, a.createdAt);
});

test('fabrics: the same image gets the same id once', async () => {
  await repo.openStorage({ db: memoryDb(), legacy: null });
  const img = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' });
  const a = await repo.fabrics.add(img, { name: 'One', cm: 10 });
  const b = await repo.fabrics.add(new Blob([new Uint8Array([1, 2, 3, 4, 5])]), { name: 'Again', cm: 12 });
  assert.equal(a.isNew, true);
  assert.equal(b.isNew, false);
  assert.equal(a.id, b.id);
  assert.match(a.id, /^f[0-9a-f]{24}$/);
  assert.equal(repo.fabrics.list().length, 1);
});

test('writes in one moment go to the database together, the last value of each record', async () => {
  const db = memoryDb(),
    batches = [];
  const spy = { ...db, write: ops => (batches.push(ops.length), db.write(ops)) };
  await repo.openStorage({ db: spy, legacy: null });
  batches.length = 0;
  for (let i = 0; i < 5; i++) repo.setSession('current', { n: i });
  repo.timelines.set('draft', { steps: [], i: -1, seq: 0 });
  await repo.flush();
  assert.deepEqual(batches, [2]);
  assert.deepEqual((await db.getAll('session')).find(r => r.key === 'current').value, { n: 4 });
});
