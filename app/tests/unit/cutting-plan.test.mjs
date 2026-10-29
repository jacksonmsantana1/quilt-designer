import test from 'node:test';
import assert from 'node:assert/strict';
import { CG } from '../../src/cutting/plan.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';
import { blockSizeMm, normalizeSpans } from '@quilt/shared/geometry.js';
import { grid, newBlockData } from './fixtures.mjs';

const plan = (d, extra = {}) =>
  CG.plan(d, {
    blockMm: d.blockMm,
    sizeOf: k => blockSizeMm(d, k),
    seam: 7.5,
    fabricWidth: 1500,
    selvage: 50,
    bindingFabric: 'b1',
    bindingWidth: 60,
    partsOf,
    label: k => PATTERNS[k].label,
    extra: [],
    ...extra,
  });

test('plain squares are cut at the finished size plus two seam allowances', () => {
  const P = plan(grid(2, 2, { blockMm: 100 }));
  assert.equal(P.blocks.length, 1);
  assert.equal(P.blocks[0].count, 4);
  const row = P.blocks[0].list[0];
  assert.equal(row.kind, 'square');
  assert.deepEqual(row.cut, [115, 115]);
  assert.equal(row.letter, 'A');
});

test('half-square triangles: one square cut on the diagonal gives two', () => {
  const r = CG.classify(
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    100,
    100,
    7.5,
  );
  assert.equal(r.kind, 'hst');
  assert.equal(r.yield, 2);
  assert.equal(r.cut[0], Math.ceil(100 + 7.5 * (2 + Math.SQRT2)));
});

test('quarter-square triangles: one square cut twice gives four', () => {
  const r = CG.classify(
    [
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ],
    100,
    100,
    7.5,
  );
  assert.equal(r.kind, 'qst');
  assert.equal(r.yield, 4);
});

test('blocks of the same pattern and fabrics are grouped; turning a block does not change its cutting', () => {
  const d = grid(3, 1, { blockMm: 100, pattern: 'hst' });
  d.blocks[1].rot = 1;
  d.blocks[2] = newBlockData('hst', 'b1');
  const P = plan(d);
  assert.deepEqual(P.blocks.map(b => b.count).sort(), [1, 2]);
});

test('every fabric gets its own letter, in the order it is first used', () => {
  const d = grid(2, 1, { blockMm: 100 });
  d.blocks[1] = newBlockData('plain', 'b3');
  const P = plan(d);
  assert.deepEqual(
    P.fabrics.filter(f => f.cuts.length).map(f => [f.id, f.letter]),
    [
      ['b0', 'A'],
      ['b3', 'B'],
    ],
  );
});

test('a large block is planned at its own size', () => {
  const d0 = grid(3, 3, { blockMm: 100 });
  d0.blocks[0].span = 2;
  const d = normalizeSpans(d0);
  const P = plan(d);
  const big = P.blocks.find(b => b.span === 2),
    small = P.blocks.find(b => b.span === 1);
  assert.equal(big.count, 1);
  assert.equal(big.size, 200);
  assert.equal(small.count, 5); // 9 cells - 4 covered + the large one counted apart
  assert.deepEqual(big.list[0].cut, [215, 215]);
});

test('fussy-cut pieces are cut one at a time', () => {
  const d = grid(1, 1, { blockMm: 100, pattern: 'hst' });
  d.blocks[0].fussy = { 0: [0.5, 0.5] };
  const rows = plan(d).blocks[0].list;
  const fussy = rows.find(r => r.fussy),
    plainRow = rows.find(r => !r.fussy);
  assert.equal(fussy.yield, 1);
  assert.match(fussy.how, /fussy cut/);
  assert.equal(plainRow.yield, 2);
});

test('binding: enough width-of-fabric strips to go round the quilt', () => {
  const P = plan(grid(5, 5, { blockMm: 458 }), { quiltW: 2290, quiltH: 2290 });
  const b = P.fabrics.find(f => f.binding);
  assert.equal(b.id, 'b1');
  assert.equal(b.binding.strips, Math.ceil((2 * (2290 + 2290) + 300) / 1450));
});
