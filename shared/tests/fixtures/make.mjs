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
// saved by a later version of the app
w('newer.json', {
  ...JSON.parse(fs.readFileSync(new URL('v0-before-block-sizes.json', D))),
  v: 99,
  blockMm: 300,
  backFabric: 'b0',
  future: { x: 1 },
});
