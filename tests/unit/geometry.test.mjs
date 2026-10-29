import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quiltMm,
  centreMm,
  blockRect,
  blockAt,
  sashRects,
  normalizeSpans,
  setSpan,
  spanOf,
  anchorOf,
  blockSizeMm,
  borderSidePieces,
  BORDER_TYPES,
  borderTotal,
  pointInPoly,
  sashOf,
} from '../../src/core/geometry.js';
import { grid } from './fixtures.mjs';
import { area, close } from './helpers.mjs';

test('quilt size: blocks only', () => {
  assert.deepEqual(quiltMm(grid(5, 5, { blockMm: 458 })), { W: 2290, H: 2290 });
  assert.deepEqual(quiltMm(grid(3, 1, { blockMm: 100 })), { W: 300, H: 100 });
});

test('quilt size: sashing between blocks, and around the outside', () => {
  const d = grid(5, 4, { blockMm: 100, sashing: { mm: 20, fabric: 'b0', corner: 'b1', border: false } });
  assert.deepEqual(centreMm(d), { W: 5 * 100 + 4 * 20, H: 4 * 100 + 3 * 20 });
  d.sashing.border = true;
  assert.deepEqual(centreMm(d), { W: 5 * 100 + 6 * 20, H: 4 * 100 + 5 * 20 });
});

test('quilt size: borders add twice their width', () => {
  const d = grid(2, 2, {
    blockMm: 100,
    borders: [
      { type: 'plain', mm: 30, fabrics: ['b0'] },
      { type: 'piano', mm: 50, fabrics: ['b0', 'b1'] },
    ],
  });
  assert.equal(borderTotal(d), 80);
  assert.deepEqual(quiltMm(d), { W: 360, H: 360 });
});

test('sashing with no width counts as none', () => {
  assert.equal(sashOf(grid(2, 2, { sashing: { mm: 0 } })).mm, 0);
  assert.equal(sashRects(grid(2, 2, { sashing: { mm: 0 } }), 100, 100).length, 0);
});

test('blocks tile the drawing without overlapping, and blockAt finds each one', () => {
  const d = grid(4, 3, { blockMm: 100, sashing: { mm: 10, fabric: 'b0', corner: 'b1', border: true } });
  const q = quiltMm(d),
    W = q.W,
    H = q.H; // 1 px per mm
  const rects = [];
  for (let r = 0; r < d.rows; r++)
    for (let c = 0; c < d.cols; c++) {
      const R = blockRect(d, c, r, W, H);
      assert.ok(close(R.w, 100) && close(R.h, 100));
      rects.push(R);
      assert.equal(blockAt(d, R.x + R.w / 2, R.y + R.h / 2, W, H), r * d.cols + c);
    }
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i],
        b = rects[j];
      assert.ok(
        a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9,
        'blocks overlap',
      );
    }
  // on the sashing there is no block
  assert.equal(blockAt(d, 5, 5, W, H), -1);
});

test('sashing strips and cornerstones: counts, with and without the outside frame', () => {
  const inner = grid(4, 3, { sashing: { mm: 10, fabric: 'b0', corner: 'b1', border: false } });
  const s1 = sashRects(inner, 1000, 1000);
  assert.equal(s1.filter(x => x.kind === 'sash').length, 3 * 3 + 4 * 2);
  assert.equal(s1.filter(x => x.kind === 'corner').length, 3 * 2);
  const framed = { ...inner, sashing: { ...inner.sashing, border: true } };
  const s2 = sashRects(framed, 1000, 1000);
  assert.equal(s2.filter(x => x.kind === 'sash').length, 3 * 5 + 4 * 4);
  assert.equal(s2.filter(x => x.kind === 'corner').length, 5 * 4);
});

test('a large block covers its cells and the sashing between them', () => {
  const d = setSpan(grid(4, 4, { blockMm: 100, sashing: { mm: 10, fabric: 'b0', corner: 'b1', border: false } }), 5, 2); // cell (1, 1) spans 2 × 2
  assert.equal(spanOf(d.blocks[5]), 2);
  for (const i of [6, 9, 10]) assert.equal(anchorOf(d, i), 5);
  assert.equal(anchorOf(d, 0), 0);
  assert.equal(blockSizeMm(d, 2), 210);
  const q = quiltMm(d),
    R = blockRect(d, 2, 2, q.W, q.H); // a covered cell answers with the large block
  assert.ok(close(R.w, 210) && close(R.h, 210));
  // the strips and the cornerstone inside it are gone: 24 strips + 9 corners - 4 strips - 1 corner
  const s = sashRects(d, q.W, q.H);
  assert.equal(s.filter(x => x.kind === 'sash').length, 20);
  assert.equal(s.filter(x => x.kind === 'corner').length, 8);
});

test('a large block is clipped at the edge of the quilt, and replaces a large block it overlaps', () => {
  let d = setSpan(grid(3, 3), 4, 4); // centre cell: only 2 × 2 fits
  assert.equal(spanOf(d.blocks[4]), 2);
  d = setSpan(d, 0, 2); // overlaps the first one, which goes back to 1 × 1
  assert.equal(spanOf(d.blocks[0]), 2);
  assert.equal(spanOf(d.blocks[4]), 1);
  assert.equal(anchorOf(d, 4), 0);
});

test('normalizeSpans repairs saved data: overlapping spans and stale covered marks', () => {
  const d = grid(3, 3);
  d.blocks[0].span = 2;
  d.blocks[1].span = 2; // the second overlaps the first
  d.blocks[8].under = 0; // stale
  const before = JSON.stringify(d);
  const n = normalizeSpans(d);
  assert.equal(JSON.stringify(d), before, 'the input is not changed');
  assert.equal(spanOf(n.blocks[0]), 2);
  assert.equal(n.blocks[1].under, 0);
  assert.equal(n.blocks[1].span, undefined);
  assert.equal(n.blocks[8].under, undefined);
  assert.equal(normalizeSpans(n), n, 'a consistent design comes back unchanged');
});

test('every border type fills its side exactly', () => {
  for (const type of Object.keys(BORDER_TYPES)) {
    const b = { type, mm: 60, fabrics: ['b0', 'b1', 'b2'] };
    for (const L of [600, 1234]) {
      const pieces = borderSidePieces(b, L);
      const total = pieces.reduce((s, p) => s + area(p.poly), 0);
      assert.ok(close(total, L * 60, 1e-6), `${type}, side ${L}: pieces cover ${total}, not ${L * 60}`);
      for (const p of pieces)
        for (const [x, y] of p.poly) assert.ok(x >= -1e-6 && x <= L + 1e-6 && y >= -1e-6 && y <= 60 + 1e-6);
    }
  }
});

test('pointInPoly', () => {
  const sq = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  assert.equal(pointInPoly(0.5, 0.5, sq), true);
  assert.equal(pointInPoly(1.5, 0.5, sq), false);
});
