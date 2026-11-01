// Pieces found from seam lines drawn on graph paper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area2, insidePoly, seamFaces } from '@quilt/shared/seam-faces.js';
import { checkDrawn, drawnKey } from '@quilt/shared/drawn-blocks.js';
import { gridParts } from '@quilt/shared/grid-blocks.js';

/** A polygon as a comparable string, whatever corner it starts from and whichever way round. */
const shape = p => {
  const pts = p.map(([x, y]) => `${+x.toFixed(6)},${+y.toFixed(6)}`);
  const turns = [];
  for (const seq of [pts, [...pts].reverse()])
    for (let i = 0; i < seq.length; i++) turns.push([...seq.slice(i), ...seq.slice(0, i)].join(' '));
  return turns.sort()[0];
};
const shapes = r => r.pieces.map(shape).sort();
const total = r => Math.round(r.pieces.reduce((s, p) => s + area2(p) / 2, 0) * 1e9) / 1e9;

test('no lines: the whole block is one piece', () => {
  const r = seamFaces(3, []);
  assert.deepEqual(shapes(r), [
    shape([
      [0, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ]),
  ]);
  assert.equal(r.floating, false);
});

test('two diagonals cut four quarter-square triangles; every piece runs the same way round', () => {
  const r = seamFaces(2, [
    [0, 0, 2, 2],
    [2, 0, 0, 2],
  ]);
  assert.equal(r.pieces.length, 4);
  assert.ok(r.pieces.every(p => p.length === 3 && area2(p) > 0));
  assert.equal(total(r), 4);
});

test('seams that stop short are trimmed back to where they enclose something', () => {
  const r = seamFaces(2, [
    [1, 0, 1, 1],
    [0, 0, 1.5, 1.5],
  ]);
  // the diagonal runs on past the vertical seam's end, into the open: only the triangle they close is cut off
  assert.equal(r.pieces.length, 2);
  assert.ok(
    r.pieces.some(
      p =>
        shape(p) ===
        shape([
          [0, 0],
          [1, 0],
          [1, 1],
        ]),
    ),
  );
  assert.equal(total(r), 4);
});

test('a T: the stem ends on the bar, and the bar’s pieces keep straight sides', () => {
  const r = seamFaces(4, [
    [0, 2, 4, 2],
    [2, 2, 2, 4],
  ]);
  assert.deepEqual(shapes(r), [
    shape([
      [0, 0],
      [4, 0],
      [4, 2],
      [0, 2],
    ]), // no corner at (2, 2): it is in the middle of a straight side
    shape([
      [0, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ]),
    shape([
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
    ]),
  ]);
});

test('lines crossing at points off the grid, overlapping lines, and lines drawn twice', () => {
  const r = seamFaces(3, [
    [0, 0, 3, 1],
    [0, 1, 3, 0],
    [0, 0, 3, 1], // again
    [1, 3, 1, 0],
    [1, 2, 1, 1], // inside the line above
  ]);
  assert.equal(total(r), 9);
  assert.equal(r.floating, false);
  assert.ok(r.pieces.length >= 6);
});

test('a square drawn in the middle with no seam out is left out and reported', () => {
  const square = [
    [1, 1, 3, 1],
    [3, 1, 3, 3],
    [3, 3, 1, 3],
    [1, 3, 1, 1],
  ];
  const r = seamFaces(4, square);
  assert.equal(r.floating, true);
  assert.equal(r.pieces.length, 1);
  // a seam from its corner to the block's corner joins it to the rest: now it is a piece
  const j = seamFaces(4, [...square, [0, 0, 1, 1]]);
  assert.equal(j.floating, false);
  assert.ok(
    j.pieces.some(
      p =>
        shape(p) ===
        shape([
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
        ]),
    ),
  );
  assert.equal(total(j), 16);
});

test('the on-point square of a square-in-a-square', () => {
  const r = seamFaces(4, [
    [2, 0, 4, 2],
    [4, 2, 2, 4],
    [2, 4, 0, 2],
    [0, 2, 2, 0],
  ]);
  assert.equal(r.pieces.length, 5);
  assert.ok(
    r.pieces.some(
      p =>
        shape(p) ===
        shape([
          [2, 0],
          [4, 2],
          [2, 4],
          [0, 2],
        ]),
    ),
  );
  assert.ok(
    insidePoly(
      2,
      2,
      r.pieces.find(p => p.length === 4),
    ),
  );
});

test('a graph-paper drawing is kept with its pieces and lines, and drawn like any block', () => {
  const lines = [
    [0, 0, 2, 2],
    [2, 0, 0, 2],
  ];
  const extra = seamFaces(2, lines).pieces.map((p, i) => [`Piece ${i + 1}`, i % 2, p.flat()]);
  const def = { label: 'Hourglass', n: 2, rows: 'x x\nx x', extra, paper: { lines, fills: [[1, 0.2, 1]] } };
  const ok = checkDrawn(def);
  assert.deepEqual(ok, def);
  assert.equal(gridParts(ok).length, 4);
  // the key follows the pieces, not the lines it was drawn with
  assert.equal(drawnKey({ ...def, paper: { lines: [...lines, [0, 1, 0.5, 1]], fills: [] } }), drawnKey(def));
  assert.notEqual(drawnKey({ ...def, extra: extra.map(([n, r, f]) => [n, 5 - r, f]) }), drawnKey(def));
  // damaged pieces make it unreadable; damaged lines are just left off
  assert.equal(checkDrawn({ ...def, extra: extra.slice(1) }), null, 'a hole');
  assert.equal(checkDrawn({ ...def, extra: [['x', 1, [0, 0, 9, 0, 0, 9]]] }), null, 'outside the block');
  assert.equal(checkDrawn({ ...def, extra: [['x', 7, extra[0][2]], ...extra.slice(1)] }), null, 'role');
  assert.equal('paper' in checkDrawn({ ...def, paper: { lines: [[0, 0, 5]], fills: [] } }), false);
});
