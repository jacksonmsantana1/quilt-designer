// The block editor's graph paper: seam lines, fills, symmetry, and the block it saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLine,
  blankPaper,
  eraseLine,
  fill,
  paperDef,
  paperFromParts,
  paperPieces,
  paperRoles,
} from '../../src/core/paper-drawing.js';
import { blankDrawing, paint, toRows } from '../../src/core/cell-drawing.js';
import { checkDrawn } from '@quilt/shared/drawn-blocks.js';
import { gridParts } from '@quilt/shared/grid-blocks.js';
import { shapeKey } from './helpers.mjs';

const rolesShapes = parts => parts.map(p => `${p.role}:${shapeKey(p.poly)}`).sort();

test('lines cut pieces; a fill colours the piece it falls in, and the last fill of a piece wins', () => {
  let pp = addLine(blankPaper(2), 0, 0, 2, 2);
  assert.equal(addLine(pp, 2, 2, 0, 0), pp, 'the same line drawn the other way is not added again');
  assert.equal(addLine(pp, 1, 1, 1, 1), pp, 'a dot is not a line');
  pp = fill(pp, 1.5, 0.5, 1);
  pp = fill(pp, 1.6, 0.3, 2); // the same piece again
  assert.equal(pp.fills.length, 1);
  assert.deepEqual(paperRoles(pp), [0, 2]);
  assert.equal(fill(pp, 1.6, 0.3, 2), pp, 'nothing changes');
  // a new line through a filled piece: the half with the fill in it keeps the colour, the other is background
  pp = addLine(pp, 2, 0, 0, 2);
  assert.deepEqual(
    paperPieces(pp)
      .pieces.map(p => p.role)
      .sort(),
    [0, 0, 0, 2],
  );
});

test('mirror and turn symmetry repeat lines and fills', () => {
  const m = fill(addLine(blankPaper(4), 0, 1, 1, 0, 'mirror'), 0.2, 0.2, 3, 'mirror');
  assert.equal(m.lines.length, 4);
  assert.equal(paperPieces(m).pieces.filter(p => p.role === 3).length, 4);
  const t = addLine(blankPaper(4), 2, 0, 2, 1, 'turn');
  assert.deepEqual(t.lines.length, 4);
  // erasing one takes its copies away too
  assert.equal(eraseLine(t, 2, 0.5, 0.2, 'turn').lines.length, 0);
  assert.equal(eraseLine(t, 2, 0.5, 0.2).lines.length, 3);
  assert.equal(eraseLine(t, 0.5, 3.5, 0.2), t, 'nothing near: the same drawing');
});

test('a cell drawing opened on graph paper keeps the same pieces and colours', () => {
  let dr = paint(blankDrawing(3), 0.2, 0.2, '/', 1, 'mirror');
  dr = paint(dr, 1.5, 1.1, 'q', 2, 'mirror');
  dr = paint(dr, 1.5, 0.5, '^', 3);
  const parts = gridParts({ n: 3, rows: toRows(dr) }).map(p => ({
    role: p.role,
    poly: p.poly.map(([x, y]) => [x * 3, y * 3]),
  }));
  const pp = paperFromParts(3, parts);
  assert.deepEqual(rolesShapes(paperPieces(pp).pieces), rolesShapes(parts));
});

test('the saved block: pieces with names and roles, the lines kept for later, read back by the quilt checks', () => {
  let pp = blankPaper(4);
  for (const [a, b, c, d] of [
    [2, 0, 4, 2],
    [4, 2, 2, 4],
    [2, 4, 0, 2],
    [0, 2, 2, 0],
  ])
    pp = addLine(pp, a, b, c, d);
  pp = fill(pp, 2, 2, 1); // the square on point
  pp = addLine(pp, 0.5, 0.5, 0.5, 1); // a stray seam: encloses nothing
  const def = paperDef(pp, 'Square in a square');
  assert.equal(def.extra.length, 5);
  assert.deepEqual(def.extra.map(e => e[1]).sort(), [0, 0, 0, 0, 1]);
  assert.ok(
    def.extra.some(([name]) => name.startsWith('Shape')),
    'the square on point is a shape',
  );
  assert.ok(def.extra.some(([name]) => name.startsWith('Triangle · row 1, column 1')));
  assert.equal(def.paper.lines.length, 5);
  assert.deepEqual(def.paper.fills, [[2, 2, 1]]);
  assert.deepEqual(checkDrawn(def), def);
  // a shape floating free can't be saved
  const floating = addLine(addLine(addLine(addLine(blankPaper(4), 1, 1, 3, 1), 3, 1, 3, 3), 3, 3, 1, 3), 1, 3, 1, 1);
  assert.equal(paperPieces(floating).floating, true);
  assert.equal(paperDef(floating, 'x'), null);
});
