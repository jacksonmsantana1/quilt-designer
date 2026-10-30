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
  uniteOf,
  anchorOf,
  blockSizeMm,
  borderSidePieces,
  BORDER_TYPES,
  borderTotal,
  pointInPoly,
  sashOf,
  CORNER_BLOCK_MIN_MM,
  blockOutline,
  blockPlace,
  cellCount,
  cellName,
  convexOverlap,
  placedPolys,
  settingPieces,
} from '@quilt/shared/geometry.js';
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

// sashing pieces by kind and size (w × h, rounded to whole mm on a 1 px per mm drawing)
const sashKinds = d => {
  const q = quiltMm(d),
    out = {};
  for (const r of sashRects(d, q.W, q.H)) {
    const k = `${r.kind} ${Math.round(r.w)}x${Math.round(r.h)}`;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
};
const sashArea = d => {
  const q = quiltMm(d);
  return sashRects(d, q.W, q.H).reduce((a, r) => a + r.w * r.h, 0);
};

test('without cornerstones, the strips between the rows run the full width', () => {
  const s = { mm: 10, fabric: 'b0', corner: 'b1' };
  const on = grid(3, 3, { blockMm: 100, sashing: s }),
    off = grid(3, 3, { blockMm: 100, sashing: { ...s, cornerstones: false } });
  assert.equal(sashOf(on).cornerstones, true); // a missing value means cornerstones
  assert.equal(sashOf(off).cornerstones, false);
  assert.deepEqual(sashKinds(on), { 'sash 10x100': 6, 'sash 100x10': 6, 'corner 10x10': 4 });
  assert.deepEqual(sashKinds(off), { 'long 320x10': 2, 'sash 10x100': 6 });
  assert.ok(close(sashArea(off), sashArea(on)), 'the same area of sashing, just cut differently');
  // around the outside too: the top and bottom strips also run the full width, the sides fit between them
  assert.deepEqual(sashKinds({ ...off, sashing: { ...off.sashing, border: true } }), {
    'long 340x10': 4,
    'sash 10x100': 12,
  });
});

test('without cornerstones, a large block breaks the long strips', () => {
  const s = { mm: 10, fabric: 'b0', corner: 'b1', cornerstones: false };
  // cell (1, 1) of a 4 × 4 quilt spans 2 × 2: the lines above and below it are whole; the line through it is
  // cut in two, each piece a strip and the crossing beside the block (100 + 10 mm)
  const d = setSpan(grid(4, 4, { blockMm: 100, sashing: s }), 5, 2);
  assert.deepEqual(sashKinds(d), { 'long 430x10': 2, 'long 110x10': 2, 'sash 10x100': 10 });
  // two large blocks side by side: the crossing between them joins the strips above and below it
  const two = setSpan(setSpan(grid(4, 2, { blockMm: 100, sashing: s }), 0, 2), 2, 2);
  assert.deepEqual(sashKinds(two), { 'long 10x210': 1 });
});

test('a cornerstone block is used only on sashing wider than 75 mm, with cornerstones on', () => {
  const cornerBlock = { pattern: 'nine', rot: 0, fabrics: Array(9).fill('b1') };
  const at = (mm, more = {}) =>
    sashOf(grid(2, 2, { sashing: { mm, fabric: 'b0', corner: 'b3', cornerBlock, ...more } }));
  assert.equal(CORNER_BLOCK_MIN_MM, 76);
  assert.equal(at(75).cornerBlock, null); // too narrow: plain cornerstones, the block stays saved
  assert.equal(at(76).cornerBlock, cornerBlock);
  assert.equal(at(100, { cornerstones: false }).cornerBlock, null); // no cornerstones at all
  assert.equal(sashOf(grid(2, 2, { sashing: { mm: 100 } })).cornerBlock, null); // none chosen
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

// ---- on point
const onPoint = (cols, rows, extra = {}) => {
  const d = { ...grid(cols, rows, { blockMm: 100, ...extra }), setting: 'onpoint' };
  return { ...d, blocks: [...d.blocks, ...grid(cols - 1 || 1, rows - 1 || 1).blocks].slice(0, cellCount(d)) };
};

test('on point: each column and row is a block diagonal wide; blocks between the others', () => {
  const d = onPoint(3, 3);
  assert.equal(cellCount(d), 9 + 4);
  assert.deepEqual(centreMm(d), { W: 300 * Math.SQRT2, H: 300 * Math.SQRT2 });
  const framed = sashOf({ ...d, sashing: { mm: 50 } });
  assert.deepEqual([framed.mm, framed.border], [50, true], 'on point the sashing frames every block');
  assert.equal(cellName(d, 4), '2, 2');
  assert.equal(cellName(d, 9), '1½, 1½');
  assert.equal(cellName(d, 12), '2½, 2½');
});

test('on point: blocks and setting triangles fill the quilt exactly, borders included', () => {
  for (const d of [
    onPoint(3, 3),
    onPoint(4, 2),
    onPoint(1, 3),
    onPoint(3, 3, { borders: [{ type: 'plain', mm: 40, fabrics: ['b1'] }] }),
  ]) {
    const q = quiltMm(d),
      cm = centreMm(d),
      sp = settingPieces(d, q.W, q.H);
    assert.equal(sp.filter(p => p.kind === 'side').length, 2 * (d.cols - 1) + 2 * (d.rows - 1));
    assert.equal(sp.filter(p => p.kind === 'corner').length, 4);
    let A = sp.reduce((a, p) => a + area(p.poly), 0);
    for (let i = 0; i < cellCount(d); i++) A += area(blockOutline(blockPlace(d, i, q.W, q.H)));
    assert.ok(close(A, cm.W * cm.H), `${d.cols} × ${d.rows}: ${A} of ${cm.W * cm.H}`);
  }
});

test('on point: blockAt finds each diamond, and nothing in the triangles', () => {
  const d = onPoint(3, 2),
    q = quiltMm(d);
  for (let i = 0; i < cellCount(d); i++) {
    const P = blockPlace(d, i, q.W, q.H);
    assert.equal(blockAt(d, P.x + P.w / 2, P.y + P.h / 2, q.W, q.H), i);
    // the parts of the block sit inside its diamond
    for (const poly of placedPolys(d.blocks[i], P)) for (const [x, y] of poly) assert.ok(x >= -1e-9 && y >= -1e-9);
  }
  for (const sp of settingPieces(d, q.W, q.H)) {
    const [x, y] = sp.poly.reduce(([a, b], [px, py]) => [a + px / 3, b + py / 3], [0, 0]);
    assert.equal(blockAt(d, x, y, q.W, q.H), -1);
  }
});

test('on point: a large block is a bigger diamond of k × k diamonds, as many as fit on the quilt', () => {
  const d = onPoint(3, 3, { sashing: { mm: 20, fabric: 'b0', corner: 'b1' } }),
    q = quiltMm(d);
  // block 4 (row 2, column 2) and the 3 around it to the lower right make a 2 × 2 diamond of diamonds
  const two = setSpan(d, 4, 2);
  assert.equal(two.blocks[4].span, 2);
  assert.equal(two.blocks.filter(b => b.under === 4).length, 3);
  // its place: 2 blocks and the strip between them on each side, turned
  const P = blockPlace(two, 4, q.W, q.H);
  assert.ok(close(P.w, 2 * 100 + 20) && P.turn > 0);
  // a covered diamond answers with the large one, and a click in it finds the large one
  for (let i = 0; i < cellCount(two); i++)
    if (two.blocks[i].under === 4) {
      assert.deepEqual(blockPlace(two, i, q.W, q.H), P);
      assert.equal(blockAt(two, P.x + P.w / 2, P.y + P.h / 2, q.W, q.H), 4);
    }
  // blocks, sashing (none inside the large diamond) and triangles still fill the quilt exactly
  let A = settingPieces(two, q.W, q.H).reduce((a, p) => a + area(p.poly), 0);
  A += sashRects(two, q.W, q.H).reduce((a, r) => a + area(blockOutline(r)), 0);
  for (let i = 0; i < cellCount(two); i++)
    if (two.blocks[i].under == null) A += area(blockOutline(blockPlace(two, i, q.W, q.H)));
  assert.ok(close(A, centreMm(two).W * centreMm(two).H));
  // at the zig-zag edge there are fewer diamonds: a 3 × 3 asked for there shrinks to what fits
  const edge = setSpan(d, 0, 3);
  assert.ok(spanOf(edge.blocks[0]) < 3);
});
test('convexOverlap: a rectangle and a diamond', () => {
  const diamond = [
    [1, 0],
    [2, 1],
    [1, 2],
    [0, 1],
  ];
  const box = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  assert.equal(convexOverlap(box(0.9, 0.9, 1.1, 1.1), diamond), true); // inside
  assert.equal(convexOverlap(box(0, 0, 0.4, 0.4), diamond), false); // in the empty corner of its box
  assert.equal(convexOverlap(box(-1, 0.9, 3, 1.1), diamond), true); // a thin strip right across
  assert.equal(convexOverlap(box(2, 0, 3, 2), diamond), false); // only touching
});

test('on point with sashing: every block framed; blocks, sashing and triangles fill the quilt exactly', () => {
  for (const [cols, rows, mm, cornerstones, brd] of [
    [3, 3, 50, true, 0],
    [3, 3, 50, false, 0],
    [4, 2, 30, true, 60],
    [1, 3, 40, true, 0],
  ]) {
    const d = onPoint(cols, rows, {
      sashing: { mm, fabric: 'b0', corner: 'b1', cornerstones },
      borders: brd ? [{ type: 'plain', mm: brd, fabrics: ['b1'] }] : [],
    });
    const q = quiltMm(d),
      cm = centreMm(d),
      sr = sashRects(d, q.W, q.H);
    // the straight size with sashing all round, turned
    assert.ok(close(cm.W, Math.SQRT2 * (cols * (100 + mm) + mm)));
    let A =
      settingPieces(d, q.W, q.H).reduce((a, p) => a + area(p.poly), 0) +
      sr.reduce((a, r) => a + area(blockOutline(r)), 0);
    for (let i = 0; i < cellCount(d); i++) {
      const P = blockPlace(d, i, q.W, q.H);
      A += area(blockOutline(P));
      assert.equal(blockAt(d, P.x + P.w / 2, P.y + P.h / 2, q.W, q.H), i);
    }
    assert.ok(close(A, cm.W * cm.H), `${cols} × ${rows}, ${mm} mm: ${A} of ${cm.W * cm.H}`);
    // nothing reaches past the centre
    for (const r of sr)
      for (const [x, y] of blockOutline(r))
        assert.ok(x > brd - 1e-6 && y > brd - 1e-6 && x < brd + cm.W + 1e-6 && y < brd + cm.H + 1e-6);
  }
});

test('on point with sashing: strips all round each block; without cornerstones, long strips on the diagonals', () => {
  const kinds = d => {
    const q = quiltMm(d),
      out = {};
    for (const r of sashRects(d, q.W, q.H)) {
      const k = `${r.kind} ${Math.round(Math.max(r.w, r.h))}`;
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  };
  const s = { mm: 50, fabric: 'b0', corner: 'b1' };
  // 9 + 4 blocks: each strip between two blocks once, and the frame round the outside
  assert.deepEqual(kinds(onPoint(3, 3, { blockMm: 300, sashing: s })), { 'sash 300': 36, 'corner 50': 24 });
  assert.deepEqual(kinds(onPoint(3, 3, { blockMm: 300, sashing: { ...s, cornerstones: false } })), {
    'long 1800': 2,
    'long 1100': 2,
    'long 400': 2,
    'sash 300': 18,
  });
});

test('uniting: a selection must cover a square of 2 × 2 to 4 × 4 cells exactly', () => {
  const d = grid(5, 5);
  assert.deepEqual(uniteOf(d, [0, 1, 5, 6]), { i: 0, k: 2 }); // the top-left block and the size
  assert.deepEqual(uniteOf(d, [6, 7, 8, 11, 12, 13, 16, 17, 18]), { i: 6, k: 3 });
  assert.deepEqual(uniteOf(d, [0, 1, 2, 5, 6, 7]), { why: 'square' }); // 3 × 2
  assert.deepEqual(uniteOf(d, [0, 1, 5]), { why: 'square' }); // an L
  assert.deepEqual(uniteOf(d, [7]), { why: 'one' });
  assert.deepEqual(uniteOf(d, [...Array(25).keys()]), { why: 'size' }); // 5 × 5
  // a large block in the selection counts with all its cells: 2 × 2 at block 6, plus 0, 1, 2, 5, 10 → 3 × 3
  assert.deepEqual(uniteOf(setSpan(d, 6, 2), [0, 1, 2, 5, 6, 10]), { i: 0, k: 3 });
});

test('uniting on point: the diamonds must make a bigger diamond', () => {
  const d = onPoint(3, 3);
  // block 4 (row 2, column 2), the ones between it and its lower neighbours (11, 12), and block 7 below it
  assert.deepEqual(uniteOf(d, [4, 11, 12, 7]), { i: 4, k: 2 });
  assert.deepEqual(uniteOf(d, [4, 5]), { why: 'square' }); // two diamonds side by side only touch at a corner
});
