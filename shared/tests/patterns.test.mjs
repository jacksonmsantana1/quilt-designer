import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, partsOf, rotPoly, orientPoly } from '@quilt/shared/patterns.js';
import { area, close, shapeKey } from './helpers.mjs';

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
