// Shape mosaics: the hexagons cover the quilt exactly, are numbered row by row, and know their neighbours; saved
// mosaics are checked and repaired like the rest of a design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mosaicMm, mosaicTiles, tileAt, tileCount, tileNeighbours } from '@quilt/shared/mosaic.js';
import { readDesign } from '@quilt/shared/format.js';
import { defaultDesign } from '@quilt/shared/design.js';

const area = p => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};
const hex = (cols, rows, mm = 50) => ({ shape: 'hex', mm, cols, rows });

test('the hexagons cover the trimmed quilt exactly, with no gaps or overlaps', () => {
  for (const m of [hex(5, 5), hex(1, 1), hex(8, 3, 37), hex(12, 15, 25)]) {
    const { w, h } = mosaicMm(m),
      tiles = mosaicTiles(m);
    const total = tiles.reduce((s, t) => s + area(t.poly), 0);
    assert.ok(Math.abs(total / (w * h) - 1) < 1e-9, `${m.cols} × ${m.rows}: ${total} of ${w * h}`);
    for (const t of tiles)
      for (const [x, y] of t.poly) assert.ok(x >= -1e-9 && x <= w + 1e-9 && y >= -1e-9 && y <= h + 1e-9);
  }
});

test('size, count and order: rows of whole hexagons, every other one with a half at each end', () => {
  const m = hex(5, 5);
  const { w, h } = mosaicMm(m);
  assert.ok(Math.abs(w - 5 * Math.sqrt(3) * 50) < 1e-9);
  assert.equal(h, 50 + 4 * 75);
  assert.equal(tileCount(m), 6 + 5 + 6 + 5 + 6);
  const tiles = mosaicTiles(m);
  assert.deepEqual(
    tiles.map(t => t.row),
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4],
  );
  // inside rows: whole hexagons, the ends of every other row halves; the top and bottom rows lose their points
  assert.deepEqual(
    tiles.filter(t => t.row === 2).map(t => t.whole),
    [false, true, true, true, true, false],
  );
  assert.ok(tiles.filter(t => t.row === 1).every(t => t.whole));
  assert.ok(tiles.filter(t => t.row === 0).every(t => !t.whole));
  assert.equal(mosaicTiles(m), mosaicTiles({ ...m, fabrics: [] }), 'the same size gives the same (kept) list');
});

test('the shape under a point, and the six around a hexagon', () => {
  const m = hex(5, 5);
  const centre = mosaicTiles(m).findIndex(t => t.row === 2 && t.col === 2);
  assert.equal(tileAt(m, 2 * Math.sqrt(3) * 50, 25 + 150), centre);
  assert.equal(tileAt(m, -5, 10), -1);
  const around = tileNeighbours(m, centre);
  assert.equal(around.length, 6);
  // each neighbour's centre is one hexagon width away
  const mid = i => {
    const p = mosaicTiles(m)[i].poly;
    return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  };
  const [cx, cy] = mid(centre);
  for (const k of around) {
    const [x, y] = mid(k);
    assert.ok(Math.abs(Math.hypot(x - cx, y - cy) - Math.sqrt(3) * 50) < 1e-6, `neighbour ${k}`);
  }
  // at the edge: fewer neighbours, and the relation goes both ways
  for (let i = 0; i < tileCount(m); i++)
    for (const k of tileNeighbours(m, i)) assert.ok(tileNeighbours(m, k).includes(i));
  assert.ok(tileNeighbours(m, 0).length < 6);
});

test('a saved mosaic is checked: size in range, one fabric per shape', () => {
  const base = { ...defaultDesign(), mosaic: { ...hex(4, 3, 60), fabrics: Array(tileCount(hex(4, 3))).fill('b1') } };
  const ok = readDesign(base);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.design.mosaic, base.mosaic);

  const short = readDesign({ ...base, mosaic: { ...base.mosaic, fabrics: ['b2', 7] } });
  assert.deepEqual(short.problems, ['The mosaic was repaired.']);
  assert.equal(short.design.mosaic.fabrics.length, tileCount(hex(4, 3)));
  assert.deepEqual(short.design.mosaic.fabrics.slice(0, 3), ['b2', 'b0', 'b0']);

  const big = readDesign({ ...base, mosaic: { ...base.mosaic, cols: 999, mm: 1 } }).design.mosaic;
  assert.equal(big.cols, 60);
  assert.equal(big.mm, 10);
  assert.equal(big.fabrics.length, tileCount(big));

  const bad = readDesign({ ...base, mosaic: { shape: 'circle', mm: 50, cols: 3, rows: 3 } });
  assert.equal(bad.design.mosaic, undefined);
  assert.deepEqual(bad.problems, ['The mosaic could not be read; the quilt shows its blocks.']);
});

test('paint tools: one shape, a rosette (it and the six around), or its whole row', async () => {
  const { tilesForTool } = await import('@quilt/shared/mosaic.js');
  const m = hex(5, 5),
    tiles = mosaicTiles(m),
    centre = tiles.findIndex(t => t.row === 2 && t.col === 2);
  assert.deepEqual(tilesForTool(m, centre, 'one'), [centre]);
  assert.deepEqual(
    tilesForTool(m, centre, 'rosette').sort((a, b) => a - b),
    [centre, ...tileNeighbours(m, centre)].sort((a, b) => a - b),
  );
  assert.equal(tilesForTool(m, centre, 'rosette').length, 7);
  const row = tilesForTool(m, centre, 'row');
  assert.equal(row.length, 6);
  assert.ok(row.every(i => tiles[i].row === 2));
  assert.deepEqual(tilesForTool(m, 999, 'row'), []);
});

test('diamonds (three to a hexagon, a cube) and triangles also cover the quilt exactly', async () => {
  const { tilesForTool } = await import('@quilt/shared/mosaic.js');
  for (const shape of ['diamond', 'triangle'])
    for (const [cols, rows] of [
      [5, 5],
      [1, 1],
      [9, 4],
    ]) {
      const m = { shape, mm: 40, cols, rows },
        { w, h } = mosaicMm(m),
        total = mosaicTiles(m).reduce((s, t) => s + area(t.poly), 0);
      assert.ok(Math.abs(total / (w * h) - 1) < 1e-9, `${shape} ${cols} × ${rows}`);
    }
  // a whole diamond: 4 equal sides; its cube: three diamonds; every top of a cube lies the same way
  const d = { shape: 'diamond', mm: 50, cols: 5, rows: 5 },
    tiles = mosaicTiles(d),
    i = tiles.findIndex(t => t.whole && t.row === 2 && t.col > 4);
  assert.equal(tiles[i].poly.length, 4);
  assert.equal(tilesForTool(d, i, 'rosette').length, 3);
  assert.equal(tileNeighbours(d, i).length, 4);
  const way = tilesForTool(d, i, 'way');
  assert.ok(way.every(k => tiles[k].way === tiles[i].way) && way.length > 10);
  // triangles: three around each, points up and down in turn
  const t = { shape: 'triangle', mm: 50, cols: 6, rows: 4 },
    tt = mosaicTiles(t),
    j = tt.findIndex(x => x.whole && x.row === 1 && x.col > 3);
  assert.equal(tileNeighbours(t, j).length, 3);
  assert.notEqual(tt[j].way, tt[j + 1].way);
  // hexagons all lie one way: Same way paints just the one
  assert.deepEqual(tilesForTool(hex(5, 5), 3, 'way'), [3]);
});
