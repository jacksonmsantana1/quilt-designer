// The block reader on shaded diagrams (flat greys, a thin line round every cell): the drawn lines decide which cells are
// one piece, and a hatched fabric is not mistaken for a flat grey of the same average colour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBlock } from '@quilt/shared/block-reader.js';

/**
 * A 4 × 4 block, 100 px cells at (40, 40) on white paper, as RGB. `fill(i, j, x, y)` gives the grey of a pixel of cell
 * (i, j); lines (3 px, dark) are drawn round every cell when `lines`.
 */
function diagram(fill, lines) {
  const W = 480,
    data = new Uint8Array(W * W * 3).fill(255);
  const put = (x, y, v) => data.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
  for (let y = 40; y < 440; y++)
    for (let x = 40; x < 440; x++) {
      const i = Math.floor((x - 40) / 100),
        j = Math.floor((y - 40) / 100);
      let v = fill(i, j, (x - 40) % 100, (y - 40) % 100);
      if (lines && ((x - 40) % 100 < 3 || (y - 40) % 100 < 3 || x >= 437 || y >= 437)) v = 50;
      put(x, y, v);
    }
  return { width: W, height: W, data, channels: 3 };
}
const tokens = rows => rows.split('\n').map(r => r.trim().split(/\s+/));

test('cells of one grey stay separate where a line is drawn between them, and join where none is', () => {
  const fill = (i, j) => (i === 1 && j === 1 ? 70 : 205);
  const drawn = readBlock(diagram(fill, true));
  assert.equal(drawn.n, 4);
  assert.ok(!/[-|+]/.test(drawn.rows), `a line round every cell: no merged pieces\n${drawn.rows}`);
  const bare = readBlock(diagram(fill, false));
  assert.ok(/[-|+]/.test(bare.rows), 'with no lines the light cells are joined into bigger pieces');
});

test('a hatched fabric is another fabric than a flat grey of the same average colour', () => {
  // a checkerboard of dark and light cells; the bottom row: two hatched cells (1 px of 100 in every 4, on 200: average
  // 175), then two flat cells of grey 175
  const fill = (i, j, x) => (j === 3 ? (i < 2 ? (x % 4 === 0 ? 100 : 200) : 175) : (i + j) % 2 ? 70 : 230);
  const r = readBlock(diagram(fill, true)),
    t = tokens(r.rows);
  assert.equal(r.n, 4);
  assert.equal(t[3][0], t[3][1], 'the hatched cells are one fabric');
  assert.equal(t[3][2], t[3][3], 'the flat grey cells are one fabric');
  assert.notEqual(t[3][0], t[3][2], 'hatched and flat are two fabrics');
});
