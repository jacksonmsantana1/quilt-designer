import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oDiag,
  oLR,
  oTB,
  setSymmetry,
  symOf,
  symPartners,
  symmetrySources,
  withSymmetry,
} from '../../src/core/symmetry.js';
import { blockPlace, normalizeSpans, placedPolys, setSpan } from '@quilt/shared/geometry.js';
import { orientPoly } from '@quilt/shared/patterns.js';
import { grid } from './fixtures.mjs';
import { shapeKey } from './helpers.mjs';

const tri = [
  [0.1, 0.1],
  [0.7, 0.2],
  [0.3, 0.8],
]; // a shape with no symmetry of its own
const orientations = [];
for (let rot = 0; rot < 4; rot++) for (const flip of [false, true]) orientations.push({ rot, flip });

test('the orientation transforms mirror the block exactly', () => {
  for (const o of orientations) {
    const p = orientPoly(tri, o);
    assert.equal(shapeKey(orientPoly(tri, oLR(o))), shapeKey(p.map(([x, y]) => [1 - x, y])), 'left-right');
    assert.equal(shapeKey(orientPoly(tri, oTB(o))), shapeKey(p.map(([x, y]) => [x, 1 - y])), 'top-bottom');
    assert.equal(shapeKey(orientPoly(tri, oDiag(o))), shapeKey(p.map(([x, y]) => [y, x])), 'diagonal');
  }
});

test('each mirror undone by itself', () => {
  for (const o of orientations)
    for (const f of [oLR, oTB, oDiag]) assert.deepEqual(f(f(o)), { rot: o.rot, flip: o.flip });
});

test('symmetry modes: kaleidoscope needs a square layout', () => {
  assert.equal(symOf(grid(4, 4, { sym: 'kal' })), 'kal');
  assert.equal(symOf(grid(4, 3, { sym: 'kal' })), 'both');
  assert.equal(symOf(grid(4, 4)), 'off');
  assert.equal(symOf(grid(4, 4, { sym: 'nonsense' })), 'off');
});

test('mirror partners of a block', () => {
  const at = (d, i) =>
    symPartners(i, d)
      .map(([j]) => j)
      .sort((a, b) => a - b);
  assert.deepEqual(at(grid(4, 4, { sym: 'lr' }), 0), [3]);
  assert.deepEqual(at(grid(4, 4, { sym: 'tb' }), 0), [12]);
  assert.deepEqual(at(grid(4, 4, { sym: 'both' }), 0), [3, 12, 15]);
  assert.deepEqual(at(grid(5, 5, { sym: 'kal' }), 1), [3, 5, 9, 15, 19, 21, 23]); // 8-way: 7 partners
  assert.deepEqual(at(grid(5, 5, { sym: 'both' }), 12), []); // the centre of an odd layout
  assert.deepEqual(at(grid(4, 4), 0), []);
});

// ---- on point (square quilts only): the mirror lines run through the screen's centre, across turned blocks
const onPoint = (n, extra = {}) => {
  const d = grid(n, n, { pattern: 'logcabin', setting: 'onpoint', ...extra }); // log cabin: no symmetry of its own
  return { ...d, blocks: [...d.blocks, ...grid(n - 1, n - 1, { pattern: 'logcabin' }).blocks] };
};
// points rounded to 0.001 (and -0 made 0): turned blocks land a hair off whole numbers
const near = poly =>
  poly
    .map(([x, y]) => `${(Math.round(x * 1000) / 1000 + 0).toFixed(3)},${(Math.round(y * 1000) / 1000 + 0).toFixed(3)}`)
    .sort()
    .join(' ');
const partners = (d, i) =>
  symPartners(i, d)
    .map(([j]) => j)
    .sort((a, b) => a - b);

test('on point: symmetry only on a square quilt', () => {
  assert.equal(symOf(onPoint(4, { sym: 'kal' })), 'kal');
  const wide = { ...grid(4, 3, { setting: 'onpoint', sym: 'both' }) };
  assert.equal(symOf(wide), 'off'); // paused, not forgotten
  assert.equal(wide.sym, 'both');
  assert.deepEqual(symPartners(0, wide), []);
});

test('on point, 4-way on 3 × 3: a corner diamond goes to the other corners, a diamond between to the others between', () => {
  const d = onPoint(3, { sym: 'both' });
  assert.deepEqual(partners(d, 0), [2, 6, 8]);
  assert.deepEqual(partners(d, 9), [10, 11, 12]); // the 2 × 2 between the blocks
  assert.deepEqual(partners(d, 1), [7]); // on the up-down line: only its partner across the other line
  assert.deepEqual(partners(d, 4), []); // the centre
});

test('on point, 8-way on 4 × 4: a diamond off every mirror line has 7 partners', () => {
  const d = onPoint(4, { sym: 'kal' });
  assert.deepEqual(partners(d, 1), [2, 4, 7, 8, 11, 13, 14]);
  assert.deepEqual(partners(d, 0), [3, 12, 15]); // on a diagonal: 4 of them
});

test('on point: every partner is the exact mirror image across its line', () => {
  for (const sym of ['lr', 'tb', 'both', 'kal'])
    for (const n of [3, 4]) {
      const d = onPoint(n, { sym }),
        W = 1000,
        H = 1000,
        m = W / 2;
      // each mirror of the screen, about the quilt's centre
      const lines = {
        lr: ([x, y]) => [2 * m - x, y],
        tb: ([x, y]) => [x, 2 * m - y],
        rot: ([x, y]) => [2 * m - x, 2 * m - y],
        d1: ([x, y]) => [y, x],
        d2: ([x, y]) => [2 * m - y, 2 * m - x],
        r1: ([x, y]) => [2 * m - y, x],
        r2: ([x, y]) => [y, 2 * m - x],
      };
      for (let i = 0; i < d.blocks.length; i++)
        for (const o of orientations) {
          const src = { ...d.blocks[i], ...o },
            mine = placedPolys(src, blockPlace(d, i, W, H));
          for (const [j, f] of symPartners(i, d)) {
            const t = f(o),
              theirs = placedPolys({ ...d.blocks[j], ...t }, blockPlace(d, j, W, H));
            // one of the screen's mirrors (or turns, for the 8-way) takes this block's parts onto the partner's, part by part
            const ok = Object.values(lines).some(L => theirs.every((p, k) => near(p) === near(mine[k].map(L))));
            assert.ok(ok, `${sym} ${n}×${n}: block ${i} → ${j}, ${JSON.stringify(o)}`);
          }
        }
    }
});

test('on point: a large diamond mirrors as a large diamond', () => {
  // 5 × 5 with a 2 × 2 diamond in the top left (block 1, the two between below it and block 6); a big diamond is
  // twice a block's height and width, so on smaller quilts it would cross a mirror line and overlap its own image
  const d = normalizeSpans(onPoint(5, { sym: 'both' }));
  const big = setSpan(d, 1, 2);
  const n = withSymmetry(big, [1]);
  const anchors = n.blocks.flatMap((b, i) => (b.span === 2 ? [i] : []));
  assert.deepEqual(anchors, [1, 3, 16, 18]); // top left, top right, bottom left, bottom right
  for (const a of anchors) {
    const P = blockPlace(n, a, 1000, 1000);
    assert.ok(Math.abs(P.w - blockPlace(n, 1, 1000, 1000).w) < 1e-9);
  }
});

test('on point: turning symmetry on copies the top-left part', () => {
  const d = onPoint(3);
  const marked = { ...d, blocks: d.blocks.map((b, i) => (i === 0 ? { ...b, rot: 1 } : b)) };
  const n = setSymmetry(marked, 'both');
  for (const j of [2, 6, 8]) assert.notDeepEqual(n.blocks[j], d.blocks[j], `corner ${j} copied`);
  assert.deepEqual(symmetrySources(onPoint(3, { sym: 'both' })), [0, 1, 3, 4, 9]);
  assert.deepEqual(symmetrySources(onPoint(3, { sym: 'kal' })), [0, 1, 4, 9]); // 9: between, on the diagonal
});
