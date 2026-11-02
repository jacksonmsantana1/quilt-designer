// The shape of the quilted top that the photo render uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestStitch, quiltRelief, refineGrid, reliefNormals, softBlur } from '../../src/render/relief.js';

/** a w × h mask with one stitched column */
function columnMask(w, h, col) {
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) mask[y * w + col] = 1;
  return mask;
}

test('nearestStitch gives the exact distance and the winning pixel', () => {
  const w = 40,
    h = 30,
    mask = new Uint8Array(w * h);
  const stitches = [
    [5, 5],
    [33, 21],
    [12, 28],
  ];
  for (const [x, y] of stitches) mask[y * w + x] = 1;
  const { dist, near } = nearestStitch(mask, w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const best = Math.min(...stitches.map(([sx, sy]) => Math.hypot(x - sx, y - sy)));
      assert.ok(Math.abs(dist[y * w + x] - best) < 1e-5, `distance at ${x},${y}`);
      const nx = near[y * w + x] % w,
        ny = Math.floor(near[y * w + x] / w);
      assert.ok(Math.abs(Math.hypot(x - nx, y - ny) - best) < 1e-5, `nearest stitch of ${x},${y}`);
    }
});

test('nearestStitch with no stitches says so', () => {
  const { near } = nearestStitch(new Uint8Array(12), 4, 3);
  assert.ok(near.every(v => v === -1));
});

test('softBlur keeps a flat image flat and the total of a spot', () => {
  const flat = softBlur(new Float32Array(100).fill(3), 10, 10, 2);
  assert.ok(flat.every(v => Math.abs(v - 3) < 1e-5));
  const w = 41,
    spot = new Float32Array(w * w);
  spot[20 * w + 20] = 1;
  const blurred = softBlur(spot, w, w, 2);
  assert.ok(Math.abs(blurred.reduce((a, b) => a + b, 0) - 1) < 1e-4);
  assert.ok(blurred[20 * w + 20] < 1);
});

test('quiltRelief sinks at the stitches, rises between them and meets the binding at the edge', () => {
  const w = 200,
    h = 200,
    col = 100,
    height = quiltRelief(columnMask(w, h, col), w, h, { mmPerPx: 1, depth: 8 });
  const at = x => height[100 * w + x];
  assert.ok(at(col) < -4, 'a valley at the stitch line');
  assert.ok(at(col + 40) > at(col + 3), 'the batting climbs away from it');
  assert.ok(at(col + 3) > at(col), 'even close to the line');
  for (let i = 0; i < w; i++) {
    assert.equal(Math.abs(height[i]), 0, 'the top edge');
    assert.equal(Math.abs(height[i * w]), 0, 'the left edge');
  }
});

test('quiltRelief is the same every time, and each stitch pulls in a dimple', () => {
  const w = 60,
    h = 60,
    mask = columnMask(w, h, 30),
    plain = quiltRelief(mask, w, h, { mmPerPx: 1, depth: 6 });
  assert.deepEqual(quiltRelief(mask, w, h, { mmPerPx: 1, depth: 6 }), plain);
  const thread = new Uint8Array(w * h);
  thread[30 * w + 30] = 1;
  const stitched = quiltRelief(mask, w, h, { mmPerPx: 1, depth: 6, thread });
  assert.ok(stitched[30 * w + 30] < plain[30 * w + 30]);
  assert.equal(stitched[30 * w + 20], plain[30 * w + 20]);
});

test('reliefNormals: flat is straight up, and a slope leans downhill', () => {
  const w = 8,
    h = 8;
  const flat = reliefNormals(new Float32Array(w * h), w, h, 1);
  assert.deepEqual([...flat.slice(0, 4)], [128, 128, 255, 255]);
  // rising to the right: the normal leans left (red below the middle)
  const right = new Float32Array(w * h).map((_, i) => i % w);
  assert.ok(reliefNormals(right, w, h, 1)[4 * (3 * w + 3)] < 110);
  // rising down the image, which is towards low v: the normal leans towards high v (green above the middle)
  const down = new Float32Array(w * h).map((_, i) => Math.floor(i / w));
  assert.ok(reliefNormals(down, w, h, 1)[4 * (3 * w + 3) + 1] > 146);
});

test('refineGrid passes through the original points and follows a plane exactly', () => {
  const n = 5,
    k = 4,
    fine = (n - 1) * k + 1,
    src = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      src[2 * (j * n + i)] = 2 * i + 3 * j;
      src[2 * (j * n + i) + 1] = i * i;
    }
  const out = refineGrid(src, n, k, 2);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      for (const d of [0, 1])
        assert.ok(Math.abs(out[2 * (j * k * fine + i * k) + d] - src[2 * (j * n + i) + d]) < 1e-5);
  // away from the edges, where the curve can see both sides of each point
  for (let j = k; j < fine - k; j++)
    for (let i = k; i < fine - k; i++)
      assert.ok(Math.abs(out[2 * (j * fine + i)] - ((2 * i) / k + (3 * j) / k)) < 1e-4, `plane at ${i},${j}`);
});
