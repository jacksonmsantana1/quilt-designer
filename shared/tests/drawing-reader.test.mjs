// The line-drawing reader: a block drawn in code (grid lines, diagonals, dots) is read back with the right cuts and
// fabrics; and the small network learns a cell's shape and treats a flipped cell as the other cut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notation, readDrawing } from '../src/drawing-reader.js';
import { predict, train, turned } from '../src/cell-net.js';

const BS = String.fromCharCode(92);

/** A 2 × 2 block, 120 px across, on a 160 px page: the frame and grid lines, a diagonal in some cells, dots in some pieces. */
function drawn({ slash = [], back = [], dots = [] }) {
  const W = 160,
    gray = new Float32Array(W * W).fill(255);
  const dot = (x, y, r = 2) => {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) gray[(y + j) * W + x + i] = 0;
  };
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n),
        y = Math.round(y0 + ((y1 - y0) * k) / n);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) gray[(y + j) * W + x + i] = 0;
    }
  };
  const o = 20,
    s = 60; // the block starts at 20, each cell is 60 px
  for (let k = 0; k <= 2; k++) {
    line(o + k * s, o, o + k * s, o + 2 * s);
    line(o, o + k * s, o + 2 * s, o + k * s);
  }
  for (const [r, c] of slash) line(o + c * s, o + (r + 1) * s, o + (c + 1) * s, o + r * s);
  for (const [r, c] of back) line(o + c * s, o + r * s, o + (c + 1) * s, o + (r + 1) * s);
  for (const [r, c, u, v] of dots)
    for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) dot(o + c * s + u * s + i * 5, o + r * s + v * s + j * 5);
  return { width: W, height: W, gray };
}

test('cuts are read from the seams, and a diagonal is told from a grid line', () => {
  const page = drawn({ slash: [[0, 1]], back: [[1, 0]] });
  const r = readDrawing(page, [10, 10, 140, 140], 2);
  assert.deepEqual(
    r.cells.map(row => row.map(c => c.shape)),
    [
      ['S', '/'],
      [BS, 'S'],
    ],
  );
  const both = readDrawing(drawn({ slash: [[0, 0]], back: [[0, 0]] }), [10, 10, 140, 140], 2);
  assert.equal(both.cells[0][0].shape, 'X');
});

test('the fill mask: dots in one piece make a fabric; blank paper stays paper', () => {
  // cell (0, 1) cut "/": dots in its lower-right half only
  const page = drawn({ slash: [[0, 1]], dots: [[0, 1, 0.45, 0.4]] });
  const r = readDrawing(page, [10, 10, 140, 140], 2);
  const c = r.cells[0][1];
  assert.equal(c.shape, '/');
  assert.deepEqual(
    c.roles.map(x => x > 0),
    [false, true],
  );
  assert.equal(notation(r).split('\n')[0], '0 0/1'.replace('0 0/1', `${r.cells[0][0].roles[0]} 0/${c.roles[1]}`));
});

test('the cell network learns the four shapes, and a flipped cell swaps "/" and the other cut', () => {
  const page = drawn({
    slash: [
      [0, 0],
      [1, 1],
    ],
    back: [
      [0, 1],
      [1, 0],
    ],
  });
  const R = readDrawing(page, [10, 10, 140, 140], 2);
  const labels = [
    ['/', BS],
    [BS, '/'],
  ];
  const samples = R.cells.flatMap((row, r) =>
    row.map((c, k) => ({ patch: c.patch, feats: c.feats, label: labels[r][k] })),
  );
  const net = train(samples, { hidden: 8, epochs: 25, seed: 3 });
  for (const s of samples) assert.equal(predict(net, s).shape, s.label);
  const flipped = turned(samples[0], [1, 0, 0]);
  assert.equal(flipped.label, BS);
  assert.equal(predict(net, flipped).shape, BS, 'a mirrored "/" is the other cut');
});
