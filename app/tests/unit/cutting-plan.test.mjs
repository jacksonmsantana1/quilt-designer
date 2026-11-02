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

// on point: blocks of 300 mm stand on a corner, so each column is one block diagonal (300√2 mm) wide
const onPoint = (cols, rows, extra = {}) => {
  const d = grid(cols, rows, { blockMm: 300, setting: 'onpoint', ...extra });
  d.blocks.push(...Array.from({ length: (cols - 1) * (rows - 1) }, () => newBlockData()));
  return d;
};
const SIDE = Math.ceil(300 * Math.SQRT2 + 7.5 * (2 + 2 * Math.SQRT2)), // 461: long side + seams, cut twice
  CORNER = Math.ceil(300 / Math.SQRT2 + 7.5 * (2 + Math.SQRT2)); // 238: short side + seams, cut once

test('setting triangles: sides from squares cut twice, corners from squares cut once', () => {
  assert.equal(SIDE, 461);
  assert.equal(CORNER, 238);
  for (const [cols, rows] of [
    [3, 3],
    [4, 2],
  ]) {
    const [side, corner] = CG.settingExtra(onPoint(cols, rows), 7.5);
    assert.equal(side.setting, 'side');
    assert.equal(side.kind, 'qst');
    assert.deepEqual(side.cut, [SIDE, SIDE]);
    assert.equal(side.yield, 4);
    assert.equal(side.n, 2 * (cols - 1) + 2 * (rows - 1)); // between each two blocks along every edge: 8 for both
    assert.equal(corner.setting, 'corner');
    assert.equal(corner.kind, 'hst');
    assert.deepEqual(corner.cut, [CORNER, CORNER]);
    assert.equal(corner.yield, 2);
    assert.equal(corner.n, 4);
  }
});

test('setting triangles are counted in their fabric', () => {
  const d = onPoint(4, 3, { settingFabric: 'b2' }); // 10 side triangles: 3 squares (2 spare triangles)
  const P = plan(d, { extra: CG.settingExtra(d, 7.5) });
  const f = P.fabrics.find(x => x.id === 'b2');
  assert.deepEqual(
    f.cuts.map(c => [c.kind, c.cut[0], c.pieces, c.toCut]),
    [
      ['qst', SIDE, 10, 3],
      ['hst', CORNER, 4, 2],
    ],
  );
  assert.deepEqual(
    P.sashing.map(x => x.what),
    ['Side triangles', 'Corner triangles'],
  );
  // a straight quilt has none
  assert.deepEqual(CG.settingExtra(grid(3, 3), 7.5), []);
});

test('a regular hexagon is cut from a template: across the flats √3 × side plus the seams', () => {
  const s = 50,
    hexagon = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 90);
      return [(s + s * Math.cos(a)) / 100, (s + s * Math.sin(a)) / 100];
    });
  const c = CG.classify(hexagon, 100, 100, 7.5);
  assert.equal(c.kind, 'hex');
  assert.deepEqual(c.cut, [Math.ceil(2 * s + (4 * 7.5) / Math.sqrt(3)), Math.ceil(Math.sqrt(3) * s + 15)]);
  assert.match(c.how, /finished side 50 mm/);
});
