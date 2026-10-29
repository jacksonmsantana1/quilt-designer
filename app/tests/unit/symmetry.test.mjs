import test from 'node:test';
import assert from 'node:assert/strict';
import { symOf, symPartners, oLR, oTB, oDiag } from '../../src/core/symmetry.js';
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
