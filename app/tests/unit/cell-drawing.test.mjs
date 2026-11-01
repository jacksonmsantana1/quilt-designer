// The block editor's drawing: painting, joining, symmetry, and the grid notation both ways.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES,
  blankDrawing,
  fromRows,
  join,
  paint,
  partAt,
  pieceAt,
  rolesUsed,
  split,
  toRows,
} from '../../src/core/cell-drawing.js';
import { gridParts } from '@quilt/shared/grid-blocks.js';
import { GRID_BLOCKS } from '@quilt/shared/blocks.js';
import { shapeKey } from './helpers.mjs';

/** The pieces of a grid, as comparable shapes with their roles, optionally moved. */
const partShapes = (n, rows, move = ([x, y]) => [x, y]) =>
  gridParts({ n, rows })
    .map(p => `${p.role}:${shapeKey(p.poly.map(move))}`)
    .sort();
const shapes = (dr, move) => partShapes(dr.n, toRows(dr), move);

test('a blank drawing is n × n plain squares', () => {
  const dr = blankDrawing(3);
  assert.equal(toRows(dr), '0 0 0\n0 0 0\n0 0 0');
  assert.equal(dr.pieces.length, 9);
  assert.deepEqual(fromRows(3, toRows(dr)), dr);
});

test('painting gives a cell the tool’s shape, then colours the part under the pointer', () => {
  let dr = blankDrawing(2);
  dr = paint(dr, 0.2, 0.2, '/', 1); // upper left of the first cell
  assert.equal(toRows(dr).split('\n')[0], '1/0 0');
  dr = paint(dr, 0.8, 0.8, '/', 2); // its lower right
  assert.equal(toRows(dr).split('\n')[0], '1/2 0');
  dr = paint(dr, 1.5, 0.1, 'q', 3); // the top of an hourglass
  assert.equal(toRows(dr).split('\n')[0], '1/2 q3000');
  assert.equal(paint(dr, 1.5, 0.1, 'q', 3), dr, 'nothing changes: the same drawing');
  dr = paint(dr, 0.5, 1.5, 's', 4);
  assert.equal(toRows(dr), '1/2 q3000\n4 0');
  assert.deepEqual(rolesUsed(dr), [0, 1, 2, 3, 4]);
});

test('which part a point is in, for every shape', () => {
  assert.equal(partAt('s', 0.9, 0.9), 0);
  assert.deepEqual([partAt('/', 0.1, 0.1), partAt('/', 0.9, 0.9)], [0, 1]);
  assert.deepEqual([partAt('\\', 0.1, 0.9), partAt('\\', 0.9, 0.1)], [0, 1]);
  assert.deepEqual(
    [partAt('q', 0.5, 0.1), partAt('q', 0.9, 0.5), partAt('q', 0.5, 0.9), partAt('q', 0.1, 0.5)],
    [0, 1, 2, 3],
  );
  assert.deepEqual([partAt('^', 0.5, 0.8), partAt('^', 0.05, 0.2)], [0, 1]);
  assert.deepEqual([partAt('v', 0.5, 0.2), partAt('v', 0.05, 0.8)], [0, 1]);
  assert.deepEqual([partAt('<', 0.8, 0.5), partAt('<', 0.2, 0.05)], [0, 1]);
  assert.deepEqual([partAt('>', 0.2, 0.5), partAt('>', 0.8, 0.05)], [0, 1]);
});

test('joining makes one piece, growing to take in pieces it cuts; splitting undoes it', () => {
  let dr = join(blankDrawing(4), 1, 1, 2, 2);
  assert.equal(toRows(dr), '0 0 0 0\n0 0 - 0\n0 | + 0\n0 0 0 0');
  dr = join(dr, 2, 0, 3, 1); // cuts the 2 × 2: grows to columns 1–3, rows 0–2
  assert.equal(toRows(dr), '0 0 - -\n0 | + +\n0 | + +\n0 0 0 0');
  const big = paint(dr, 2, 1.8, '^', 1);
  assert.equal(toRows(big).split('\n')[0], '0 ^10 - -');
  assert.equal(join(dr, 0, 0, 0, 0), dr, 'one cell: nothing to join');
  const back = split(dr, 2, 2);
  assert.deepEqual(toRows(back), toRows(blankDrawing(4)));
  assert.equal(split(back, 0, 0), back);
  assert.equal(pieceAt(back, 9, 9), -1);
});

test('mirror symmetry repeats a change in the four corners, mirrored', () => {
  const dr = paint(blankDrawing(4), 0.2, 0.2, '/', 1, 'mirror');
  assert.equal(toRows(dr), '1/0 0 0 0\\1\n0 0 0 0\n0 0 0 0\n1\\0 0 0 0/1');
  const j = join(blankDrawing(4), 0, 0, 1, 0, 'mirror');
  assert.equal(toRows(j), '0 - 0 -\n0 0 0 0\n0 0 0 0\n0 - 0 -');
});

test('every shape, painted with symmetry, gives a drawing that has that symmetry', () => {
  const lr = ([x, y]) => [1 - x, y],
    tb = ([x, y]) => [x, 1 - y],
    turn = ([x, y]) => [1 - y, x];
  const points = [
    [0.5, 0.1],
    [0.9, 0.5],
    [0.5, 0.9],
    [0.1, 0.5],
    [0.2, 0.2],
    [0.8, 0.8],
  ];
  const cells = [
    [0, 0],
    [1, 0],
    [0, 1],
  ];
  for (const shape of SHAPES)
    for (const [u, v] of points)
      for (const [x, y] of cells) {
        const m = paint(blankDrawing(4), x + u, y + v, shape, 2, 'mirror');
        assert.deepEqual(shapes(m, lr), shapes(m), `${shape} mirrored left-right`);
        assert.deepEqual(shapes(m, tb), shapes(m), `${shape} mirrored top-bottom`);
        const r = paint(blankDrawing(4), x + u, y + v, shape, 2, 'turn');
        assert.deepEqual(shapes(r, turn), shapes(r), `${shape} turned`);
      }
  // a joined rectangle turns into a standing one, and its goose turns with it
  let r = join(blankDrawing(4), 0, 0, 1, 0, 'turn');
  r = paint(r, 1, 0.5, '>', 1, 'turn');
  assert.deepEqual(shapes(r, turn), shapes(r));
});

test('every traditional grid block the editor can draw reads back to the same pieces and notation', () => {
  let read = 0;
  for (const def of Object.values(GRID_BLOCKS)) {
    if (def.fourfold || def.extra) continue;
    const dr = fromRows(def.n, def.rows);
    if (!dr) continue;
    read++;
    assert.deepEqual(shapes(dr), partShapes(def.n, def.rows), def.label);
    const tidy = def.rows
      .trim()
      .split('\n')
      .map(l => l.trim().split(/\s+/).join(' '))
      .join('\n');
    assert.equal(toRows(dr), tidy, def.label);
  }
  assert.ok(read > 30, `${read} blocks read`);
  assert.equal(fromRows(2, '0 x\n0 0'), null, 'a hole');
  assert.equal(fromRows(2, '10\\0 0\n0 0'), null, 'a half cut in two');
  assert.equal(fromRows(2, '0 0'), null, 'too few rows');
});
