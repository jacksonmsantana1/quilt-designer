import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, partsOf, rotPoly, orientPoly } from '@quilt/shared/patterns.js';
import { area, close, shapeKey } from './helpers.mjs';
import { pointInPoly } from '@quilt/shared/geometry.js';
import { gridParts, parseGrid } from '@quilt/shared/grid-blocks.js';
import { GRID_BLOCKS } from '@quilt/shared/blocks.js';

test('every block pattern covers its unit square exactly once', () => {
  for (const key of Object.keys(PATTERNS)) {
    const parts = partsOf(key);
    assert.ok(parts.length > 0, `${key} has parts`);
    const total = parts.reduce((s, p) => s + area(p.poly), 0);
    assert.ok(close(total, 1, 1e-6), `${key}: parts add up to ${total}, not 1`);
    for (const p of parts)
      for (const [x, y] of p.poly)
        assert.ok(
          x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9,
          `${key} / ${p.name}: point (${x}, ${y}) outside the block`,
        );
  }
});

test('every part has a name and a colour role 0, 1 or 2', () => {
  for (const key of Object.keys(PATTERNS))
    for (const p of partsOf(key)) {
      assert.equal(typeof p.name, 'string');
      assert.ok([0, 1, 2].includes(p.role), `${key} / ${p.name}: role ${p.role}`);
    }
});

test('partsOf caches the parts of a pattern', () => {
  assert.equal(partsOf('ohio'), partsOf('ohio'));
});

test('four quarter turns bring a polygon back', () => {
  const tri = [
    [0, 0],
    [0.5, 0],
    [0.2, 0.7],
  ];
  assert.deepEqual(shapeKey(rotPoly(tri, 4)), shapeKey(tri));
  assert.notEqual(shapeKey(rotPoly(tri, 1)), shapeKey(tri));
});

test('a quarter turn moves the top-left corner to the top-right', () => {
  assert.deepEqual(rotPoly([[0, 0]], 1), [[1, 0]]);
});

test('mirroring twice is the identity; mirroring flips x', () => {
  const tri = [
    [0.1, 0.2],
    [0.6, 0.2],
    [0.3, 0.9],
  ];
  assert.deepEqual(
    orientPoly(tri, { rot: 0, flip: true }),
    tri.map(([x, y]) => [1 - x, y]),
  );
  const twice = orientPoly(orientPoly(tri, { rot: 0, flip: true }), { rot: 0, flip: true });
  assert.equal(shapeKey(twice), shapeKey(tri));
});

test('no two parts of a block overlap: every point is in exactly one part', () => {
  // points on an odd grid, nudged off every seam (seams sit on simple fractions)
  const pts = [];
  for (let j = 0; j < 23; j++) for (let i = 0; i < 23; i++) pts.push([(i + 0.5137) / 23, (j + 0.4721) / 23]);
  for (const key of Object.keys(PATTERNS)) {
    const parts = partsOf(key);
    for (const [x, y] of pts) {
      const n = parts.filter(p => pointInPoly(x, y, p.poly)).length;
      assert.equal(n, 1, `${key}: point (${x.toFixed(3)}, ${y.toFixed(3)}) is in ${n} parts`);
    }
  }
});

test('every block has a label and a family; a grid block names each part differently', () => {
  for (const [key, p] of Object.entries(PATTERNS)) assert.ok(p.label && p.family, key);
  for (const key of Object.keys(GRID_BLOCKS)) {
    const names = partsOf(key).map(q => q.name);
    assert.equal(new Set(names).size, names.length, `${key}: a name used twice`);
  }
});

test('grid notation: shapes, pieces spanning cells, and clear mistakes', () => {
  const shapes = parseGrid(String.raw`
    1/0 2\0 q0120
    ^12 -   1
    1   -   |`);
  assert.deepEqual(
    shapes.map(([kind, role]) => kind + role),
    ['tri1', 'tri0', 'tri2', 'tri0', 'tri0', 'tri1', 'tri2', 'tri0', 'goose1', 'sky2', 'sky2', 'rect1', 'rect1'],
  );
  const goose = shapes[8][2]; // two cells wide, its point at the top middle
  assert.deepEqual(goose, [
    [0, 2],
    [1, 1],
    [2, 2],
  ]);
  assert.throws(() => parseGrid('1 |'), /belongs to no piece/);
  assert.throws(() => parseGrid('1 -\n| 0'), /expected "\+"/);
  assert.throws(() => parseGrid('3'), /not a piece|colour role/);
  assert.throws(() => parseGrid('1/7'), /not a piece|colour role/);
});

test('a fourfold block turns its corner about the centre', () => {
  const parts = gridParts({ n: 2, fourfold: true, rows: '1' });
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.map(p => p.name).sort(), [
    'Square · row 1, column 1',
    'Square · row 1, column 2',
    'Square · row 2, column 1',
    'Square · row 2, column 2',
  ]);
});
