// Shape mosaics as edits: turning a quilt into a mosaic and back, painting, resizing and the shape size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { paintTiles, resizeMosaic, setMosaic, setMosaicMm } from '../../src/core/edits.js';
import { defaultDesign } from '@quilt/shared/design.js';
import { centreMm, blockAt, sashRects } from '@quilt/shared/geometry.js';
import { mosaicTiles, tileCount } from '@quilt/shared/mosaic.js';

const deepFreeze = o => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

test('a quilt becomes a mosaic about its size, and back; its blocks are kept', () => {
  const d = deepFreeze({ ...defaultDesign(), sym: 'lr', sashing: { mm: 50, fabric: 'b2' } });
  const m = setMosaic(d, true, 'b4');
  assert.equal(m.mosaic.shape, 'hex');
  assert.equal(m.mosaic.fabrics.length, tileCount(m.mosaic));
  assert.ok(m.mosaic.fabrics.every(f => f === 'b4'));
  assert.equal(m.sym, undefined, 'symmetry goes off');
  assert.equal(m.blocks, d.blocks, 'the blocks are kept, shared');
  const before = centreMm(d),
    after = centreMm(m);
  assert.ok(Math.abs(after.W - before.W) < 100 && Math.abs(after.H - before.H) < 100, 'about the same size');
  assert.equal(setMosaic(m, true), m);
  const back = setMosaic(m, false);
  assert.equal(back.mosaic, undefined);
  assert.equal(back.blocks, d.blocks);
});

test('on point goes straight under a mosaic; blocks and sashing are not shown', () => {
  const onPoint = deepFreeze({ ...defaultDesign(), setting: 'onpoint' });
  // an on-point quilt has its blocks in between too: a plain 5 × 5 quilt is enough to see the setting go
  const m = setMosaic({ ...onPoint, blocks: onPoint.blocks }, true);
  assert.equal(m.setting, undefined);
  assert.equal(m.blocks.length, 25);
  assert.equal(blockAt(m, 10, 10, 500, 500), -1);
  assert.deepEqual(sashRects({ ...m, sashing: { mm: 40, fabric: 'b1' } }, 500, 500), []);
});

test('painting gives a fabric to some shapes; nothing to paint gives the same design', () => {
  const m = deepFreeze(setMosaic(defaultDesign(), true));
  const p = paintTiles(m, [0, 3, 3], 'b8');
  assert.deepEqual(
    p.mosaic.fabrics.map((f, i) => (f === 'b8' ? i : -1)).filter(i => i >= 0),
    [0, 3],
  );
  assert.equal(paintTiles(p, [0, 3], 'b8'), p);
  assert.equal(paintTiles(m, [-1, 9999], 'b8'), m);
  assert.equal(paintTiles(defaultDesign(), [0], 'b8').mosaic, undefined, 'no mosaic: nothing to paint');
});

test('resizing keeps each shape its fabric by its row and place; new ones copy the nearest', () => {
  let m = setMosaic(defaultDesign(), true);
  m = resizeMosaic(m, 4, 4);
  const tiles = mosaicTiles(m.mosaic);
  const painted = paintTiles(
    m,
    tiles.map((t, i) => (t.row === 1 && t.col === 2 ? i : -1)).filter(i => i >= 0),
    'b8',
  );
  const bigger = resizeMosaic(painted, 6, 6);
  const at = (d, r, c) => d.mosaic.fabrics[mosaicTiles(d.mosaic).findIndex(t => t.row === r && t.col === c)];
  assert.equal(at(bigger, 1, 2), 'b8');
  assert.equal(bigger.mosaic.fabrics.length, tileCount(bigger.mosaic));
  const smaller = resizeMosaic(bigger, 3, 2);
  assert.equal(at(smaller, 1, 2), 'b8');
  assert.equal(smaller.mosaic.fabrics.length, tileCount(smaller.mosaic));
  assert.equal(resizeMosaic(smaller, 3, 2), smaller);
  assert.equal(resizeMosaic(smaller, 999, 0).mosaic.cols, 60);
});

test('the shape size: in range, fabrics kept', () => {
  const m = setMosaic(defaultDesign(), true);
  const s = setMosaicMm(m, 80);
  assert.equal(s.mosaic.mm, 80);
  assert.equal(s.mosaic.fabrics, m.mosaic.fabrics);
  assert.equal(setMosaicMm(s, 80), s);
  assert.equal(setMosaicMm(s, 3).mosaic.mm, 10);
});

test('each shape its own fabric (random fills); nothing new gives the same design', async () => {
  const { paintEach } = await import('../../src/core/edits.js');
  const m = deepFreeze(setMosaic(defaultDesign(), true));
  const p = paintEach(m, [
    [0, 'b1'],
    [1, 'b2'],
    [9999, 'b3'],
  ]);
  assert.deepEqual(p.mosaic.fabrics.slice(0, 3), ['b1', 'b2', 'b0']);
  assert.equal(paintEach(p, [[0, 'b1']]), p);
});

test('another shape keeps the picture: each new shape takes the fabric under its middle', async () => {
  const { setMosaicShape } = await import('../../src/core/edits.js');
  let m = setMosaic(defaultDesign(), true);
  const half = mosaicTiles(m.mosaic)
    .map((t, i) => (t.poly[0][0] < 500 ? i : -1))
    .filter(i => i >= 0);
  m = deepFreeze(paintTiles(m, half, 'b1'));
  const d = setMosaicShape(m, 'diamond');
  assert.equal(d.mosaic.shape, 'diamond');
  assert.equal(d.mosaic.mm, m.mosaic.mm);
  assert.equal(d.mosaic.fabrics.length, tileCount(d.mosaic));
  // left part indigo, right part cream, as before
  mosaicTiles(d.mosaic).forEach((t, i) => {
    const x = t.poly.reduce((s, p) => s + p[0], 0) / t.poly.length;
    if (x < 300) assert.equal(d.mosaic.fabrics[i], 'b1');
    if (x > 700) assert.equal(d.mosaic.fabrics[i], 'b0');
  });
  assert.equal(setMosaicShape(d, 'diamond'), d);
  assert.equal(setMosaicShape(defaultDesign(), 'triangle').mosaic, undefined);
});
