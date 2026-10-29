import test from 'node:test';
import assert from 'node:assert/strict';
import { fabricIdsIn, findFabrics, shortList, withRecent } from '../../src/core/fabric-picks.js';
import { defaultDesign } from '@quilt/shared/design.js';

const BASICS = ['b0', 'b1', 'b2'];

test('fabricIdsIn finds fabrics anywhere in a design, and nothing else', () => {
  const known = new Set(['b0', 'b1', 'b3', 'fa', 'fb', 'fc', 'fd']);
  const d = {
    ...defaultDesign(),
    backFabric: 'fa',
    settingFabric: 'fb',
    sashing: { mm: 50, fabric: 'fc', corner: 'b3' },
    borders: [{ type: 'plain', mm: 80, fabrics: ['fd'] }],
  };
  const ids = fabricIdsIn(d, s => known.has(s));
  for (const id of ['fa', 'fb', 'fc', 'fd', 'b3']) assert.ok(ids.has(id), id);
  assert.ok([...ids].every(id => known.has(id)));
  assert.deepEqual([...fabricIdsIn(null, () => true)], []);
});

test('shortList: all basics, then the chosen one, the quilt, recent picks; capped', () => {
  assert.deepEqual(shortList({ basics: BASICS }), BASICS);
  assert.deepEqual(shortList({ basics: BASICS, selected: 'fs', inQuilt: ['b1', 'fq'], recent: ['fq', 'fr'] }), [
    ...BASICS,
    'fs',
    'fq',
    'fr',
  ]);
  const many = Array.from({ length: 30 }, (_, i) => 'f' + i);
  const list = shortList({ basics: BASICS, selected: 'fs', inQuilt: many, max: 10 });
  assert.equal(list.length, BASICS.length + 10);
  assert.equal(list[BASICS.length], 'fs', 'the chosen fabric is never cut off');
});

test('shortList: the newest photos fill in only while there are few others', () => {
  const newest = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
  assert.deepEqual(shortList({ basics: BASICS, newest, fill: 3 }), [...BASICS, 'n1', 'n2', 'n3']);
  assert.deepEqual(shortList({ basics: BASICS, recent: ['r1', 'r2', 'r3'], newest, fill: 3 }), [
    ...BASICS,
    'r1',
    'r2',
    'r3',
  ]);
});

test('withRecent puts the pick first, once, and keeps the list short', () => {
  assert.deepEqual(withRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
  assert.deepEqual(withRecent(['a', 'b', 'c'], 'd', 3), ['d', 'a', 'b']);
});

test('findFabrics: words in any order and case, accents ignored, within a group', () => {
  const fabs = [
    { id: 'b0', name: 'Cream cotton', basic: true },
    { id: 'b1', name: 'Teal cotton', basic: true },
    { id: 'f1', name: 'Gingham, teal on cream #4', added: 1 },
    { id: 'f2', name: 'Chintz appliquéd quilt · Met 13869', added: 3 },
    { id: 'f3', name: 'Stripe, teal on white #9', added: 2 },
  ];
  const ids = o => findFabrics(fabs, o).map(f => f.id);
  assert.deepEqual(ids({}), ['b0', 'b1', 'f2', 'f3', 'f1'], 'basics first, then photos newest first');
  assert.deepEqual(ids({ query: 'TEAL' }), ['b1', 'f3', 'f1']);
  assert.deepEqual(ids({ query: 'cream teal' }), ['f1']);
  assert.deepEqual(ids({ query: 'applique' }), ['f2']);
  assert.deepEqual(ids({ query: 'teal', group: 'mine' }), ['f3', 'f1']);
  assert.deepEqual(ids({ group: 'basic' }), ['b0', 'b1']);
  assert.deepEqual(ids({ group: 'quilt', inQuilt: new Set(['f1', 'b0']) }), ['b0', 'f1']);
  assert.deepEqual(ids({ group: 'recent', recent: ['f3', 'gone', 'b1'] }), ['f3', 'b1'], 'recent keeps its order');
  assert.deepEqual(ids({ query: 'velvet' }), []);
});
