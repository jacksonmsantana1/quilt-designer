import test from 'node:test';
import assert from 'node:assert/strict';
import { findBlocks, patternsIn } from '../../src/core/block-picks.js';
import { defaultDesign } from '@quilt/shared/design.js';

const BLOCKS = [
  { key: 'nine', label: 'Nine patch', family: 'Basics' },
  { key: 'ohio', label: 'Ohio star', family: 'Stars' },
  { key: 'shoofly', label: 'Shoo fly', family: 'Nine patch' },
  { key: 'bearspaw', label: "Bear's paw", family: 'Larger grids' },
];
const keys = o => findBlocks(BLOCKS, o).map(b => b.key);

test('findBlocks: words in the name or the family, any case', () => {
  assert.deepEqual(keys({}), ['nine', 'ohio', 'shoofly', 'bearspaw']);
  assert.deepEqual(keys({ query: 'NINE' }), ['nine', 'shoofly'], 'Shoo fly is in the Nine patch family');
  assert.deepEqual(keys({ query: 'star' }), ['ohio']);
  assert.deepEqual(keys({ query: 'bear paw' }), ['bearspaw']);
  assert.deepEqual(keys({ query: 'velvet' }), []);
});

test('findBlocks: groups', () => {
  assert.deepEqual(keys({ group: 'Stars' }), ['ohio']);
  assert.deepEqual(keys({ group: 'quilt', inQuilt: new Set(['bearspaw', 'nine']) }), ['nine', 'bearspaw']);
  assert.deepEqual(keys({ group: 'recent', recent: ['bearspaw', 'gone', 'ohio'] }), ['bearspaw', 'ohio']);
});

test('patternsIn: the blocks of a design and a pieced cornerstone, not cells under a large block', () => {
  const d = defaultDesign();
  const blocks = d.blocks.map((b, i) => (i === 1 ? { ...b, pattern: 'zzz', under: 0 } : b));
  const set = patternsIn({ ...d, blocks, sashing: { mm: 50, cornerBlock: { pattern: 'pinwheel' } } });
  assert.ok(set.has('pinwheel'));
  assert.ok(!set.has('zzz'));
  for (const b of d.blocks.filter((_, i) => i !== 1)) assert.ok(set.has(b.pattern));
  assert.equal(patternsIn(null).size, 0);
});
