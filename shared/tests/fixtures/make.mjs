// Writes the hand-made design fixtures (run once: node tests/fixtures/make.mjs). The v0-*-medallion files are real
// saves from the app before designs had a version.
import fs from 'fs';
import { partsOf } from '@quilt/shared/patterns.js';
const D = new URL('./designs/', import.meta.url);
const blk = (pattern, fab = 'b1', extra = {}) => ({
  pattern,
  rot: 0,
  fabrics: partsOf(pattern).map(() => fab),
  ...extra,
});
const w = (f, o) => fs.writeFileSync(new URL(f, D), JSON.stringify(o, null, 1) + '\n');

// the oldest saves: no block size, no backing fabric
w('v0-before-block-sizes.json', {
  cols: 3,
  rows: 2,
  blocks: [blk('ohio'), blk('nine', 'b4'), blk('ohio'), blk('nine', 'b4'), blk('ohio'), blk('nine', 'b4')],
});
// a current unversioned save with every feature: sashing, borders, a large block, a fussy cut, symmetry, quilting
w('v0-every-feature.json', {
  cols: 3,
  rows: 3,
  blockMm: 300,
  backFabric: 'b2',
  sym: 'lr',
  quilting: 'fans',
  sashing: { mm: 40, fabric: 'b0', corner: 'b3', border: true },
  borders: [{ type: 'piano', mm: 100, fabrics: ['b1', 'b0', 'b1'] }],
  blocks: [
    blk('ohio', 'b1', { span: 2 }),
    blk('plain', 'b0'),
    blk('nine'),
    blk('plain', 'b0'),
    blk('plain', 'b0'),
    blk('nine'),
    blk('nine'),
    blk('nine', 'b1', { rot: 1, flip: true }),
    blk('plain', 'b9', { fussy: { 0: [0.25, 0.5] } }),
  ],
});
// damaged in every way that can be repaired
w('broken.json', {
  v: 1,
  cols: 2,
  rows: 2,
  blockMm: 5000,
  backFabric: 42,
  sym: 'sideways',
  quilting: 'zigzag',
  sashing: 'thin',
  borders: [
    { type: 'lace', mm: 50, fabrics: [] },
    { type: 'plain', mm: 2, fabrics: ['b1', null] },
  ],
  blocks: [
    { pattern: 'no-such-pattern', rot: 0, fabrics: ['b5'] },
    { pattern: 'ohio', rot: 7, fabrics: ['b1'] },
    { ...blk('nine'), span: 9, under: 0, fussy: { 99: [0, 0] } },
  ],
});
// version 2: sashing without cornerstones (the strips between rows run the full width)
w('v2-sashing-without-cornerstones.json', {
  v: 2,
  cols: 3,
  rows: 2,
  blockMm: 250,
  backFabric: 'b0',
  sashing: { mm: 50, fabric: 'b2', corner: 'b3', border: true, cornerstones: false },
  blocks: [blk('ohio'), blk('nine', 'b4'), blk('ohio'), blk('nine', 'b4'), blk('ohio'), blk('nine', 'b4')],
});
// version 3: cornerstones pieced as a nine-patch (the sashing is wide enough: over 75 mm)
w('v3-cornerstone-block.json', {
  v: 3,
  cols: 3,
  rows: 2,
  blockMm: 250,
  backFabric: 'b0',
  sashing: { mm: 80, fabric: 'b0', corner: 'b3', border: true, cornerBlock: blk('nine', 'b1') },
  blocks: [blk('ohio'), blk('nine', 'b4'), blk('ohio'), blk('nine', 'b4'), blk('ohio'), blk('nine', 'b4')],
});
// version 4: set on point, 3 × 3 blocks and the 2 × 2 between them, setting triangles in their own fabric
w('v4-on-point.json', {
  v: 4,
  cols: 3,
  rows: 3,
  blockMm: 300,
  backFabric: 'b0',
  setting: 'onpoint',
  settingFabric: 'b2',
  borders: [{ type: 'plain', mm: 80, fabrics: ['b1', 'b1'] }],
  blocks: [
    ...Array.from({ length: 9 }, (_, i) => blk(i % 2 ? 'nine' : 'ohio', i % 2 ? 'b4' : 'b1')),
    ...Array.from({ length: 4 }, () => blk('plain', 'b0')),
  ],
});
// version 5: on point with a large block, a diamond of 2 × 2 diamonds (block 4 and the three below it: 7, 11, 12)
w('v5-on-point-large-block.json', {
  v: 5,
  cols: 3,
  rows: 3,
  blockMm: 300,
  backFabric: 'b0',
  setting: 'onpoint',
  settingFabric: 'b2',
  blocks: [
    ...Array.from({ length: 9 }, (_, i) =>
      i === 4 ? blk('ohio', 'b1', { span: 2 }) : i === 7 ? blk('nine', 'b4', { under: 4 }) : blk('nine', 'b4'),
    ),
    blk('plain', 'b0'),
    blk('plain', 'b0'),
    blk('plain', 'b0', { under: 4 }),
    blk('plain', 'b0', { under: 4 }),
  ],
});
// version 6: a square quilt on point with 4-way symmetry, its corner diamonds mirrored (turned and flipped to match)
w('v6-on-point-symmetry.json', {
  v: 6,
  cols: 3,
  rows: 3,
  blockMm: 300,
  backFabric: 'b0',
  setting: 'onpoint',
  settingFabric: 'b2',
  sym: 'both',
  blocks: [
    blk('logcabin', 'b1'),
    blk('nine', 'b4'),
    blk('logcabin', 'b1', { rot: 1, flip: true }),
    blk('nine', 'b4'),
    blk('ohio', 'b3'),
    blk('nine', 'b4'),
    blk('logcabin', 'b1', { rot: 3, flip: true }),
    blk('nine', 'b4'),
    blk('logcabin', 'b1', { rot: 2 }),
    ...Array.from({ length: 4 }, () => blk('plain', 'b0')),
  ],
});
// version 7: a hexagon mosaic (Grandmother's flower garden), the blocks kept underneath
w('v7-hexagon-mosaic.json', {
  v: 7,
  cols: 2,
  rows: 2,
  blockMm: 300,
  backFabric: 'b0',
  blocks: Array.from({ length: 4 }, () => blk('nine', 'b4')),
  mosaic: {
    shape: 'hex',
    mm: 50,
    cols: 5,
    rows: 5,
    // a rosette (mustard centre, rose petals) on cream; 28 shapes in all
    fabrics: Array.from({ length: 28 }, (_, i) => (i === 13 ? 'b3' : [7, 8, 12, 14, 18, 19].includes(i) ? 'b8' : 'b0')),
  },
});
// saved by a later version of the app
w('newer.json', {
  ...JSON.parse(fs.readFileSync(new URL('v0-before-block-sizes.json', D))),
  v: 99,
  blockMm: 300,
  backFabric: 'b0',
  future: { x: 1 },
});
