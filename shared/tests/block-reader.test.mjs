import test from 'node:test';
import assert from 'node:assert/strict';
import { findBlock, readBlock } from '@quilt/shared/block-reader.js';
import { parseGrid } from '@quilt/shared/grid-blocks.js';
import { picture, scoreRead } from './reader-pictures.mjs';

// a spread of blocks: squares, triangles both ways, hourglasses, geese, split rectangles, several grid sizes
const BLOCKS = {
  four: 2,
  nine: 3,
  ohio: 3,
  shoofly: 3,
  sawstar: 4,
  dutchman: 4,
  puss: 4,
  twentyfive: 5,
  southernpine: 5,
};

test('reads the app’s own blocks: grid size, and the answer drawn back matches the block', () => {
  for (const [key, n] of Object.entries(BLOCKS)) {
    const { n: got, right, read } = scoreRead(key, picture(key, { noise: 14, seams: true, blur: true }));
    assert.equal(got, n, `${key}: grid ${got}, not ${n}`);
    assert.ok(right >= 0.98, `${key}: ${(right * 100).toFixed(1)}% right`);
    assert.doesNotThrow(() => parseGrid(read.rows), `${key}: the notation reads back`);
  }
});

test('Southern pine comes out as the notation it is written in, four fabrics and all', () => {
  const { rows } = readBlock(picture('southernpine'));
  assert.deepEqual(
    rows.split('\n').map(r => r.trim().split(/\s+/)),
    [
      ['0/1', '0/1', '0/1', '0', '0'],
      ['1', '|', '|', '0', '0'],
      ['1/2', '3', '0', '1/0', '-'],
      ['2', '3', '3', '1/0', '-'],
      ['2', '2', '2/1', '1', '1/0'],
    ],
  );
});

test('finds the block on a page, past a caption and a dark strip at the edge', () => {
  const blk = picture('ohio'),
    W = 320,
    H = 380,
    data = new Uint8Array(W * H * 3).fill(250);
  const put = (x, y, rgb) => data.set(rgb, (y * W + x) * 3);
  for (let y = 0; y < blk.height; y++)
    for (let x = 0; x < blk.width; x++)
      put(60 + x, 90 + y, blk.data.subarray((y * blk.width + x) * 3, (y * blk.width + x) * 3 + 3));
  for (let x = 0; x < W; x++) for (let y = 0; y < 4; y++) put(x, y, [0, 0, 0]); // a dark strip along the top
  for (let x = 70; x < 200; x += 9)
    for (let y = 40; y < 52; y++) for (let k = 0; k < 5; k++) put(x + k, y, [40, 40, 40]); // "caption"
  const box = findBlock({ width: W, height: H, data });
  assert.deepEqual(box, { x0: 60, y0: 90, x1: 260, y1: 290 });
  assert.equal(readBlock({ width: W, height: H, data }).n, 3);
});

test('a picture that is all block (no paper) is read whole', () => {
  const img = picture('puss');
  assert.deepEqual(findBlock(img), { x0: 0, y0: 0, x1: img.width, y1: img.height });
});
