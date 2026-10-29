import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rotateBlocks,
  flipBlocks,
  setPartFabric,
  setPattern,
  copyBlock,
  setFussy,
  setBlockSpan,
  setSashing,
  addBorder,
  moveBorder,
  removeBorder,
  setBorderFabric,
  updateBorder,
  setQuilting,
  setBlockMm,
  setBackFabric,
  resize,
} from '../../src/core/edits.js';
import { withSymmetry, setSymmetry } from '../../src/core/symmetry.js';
import { setSpan } from '@quilt/shared/geometry.js';
import { grid, newBlockData } from './fixtures.mjs';

// a frozen design: any edit that changed its input in place would throw (modules run in strict mode)
const deepFreeze = o => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};
const frozen = (...a) => deepFreeze(grid(...a));

test('rotate: only the chosen blocks turn, the others are shared unchanged', () => {
  const d = frozen(3, 1);
  const n = rotateBlocks(d, [1]);
  assert.deepEqual(
    n.blocks.map(b => b.rot),
    [0, 1, 0],
  );
  assert.equal(n.blocks[0], d.blocks[0]);
  assert.equal(n.blocks[2], d.blocks[2]);
  assert.deepEqual(rotateBlocks(rotateBlocks(rotateBlocks(n, [1]), [1]), [1]).blocks[1].rot, 0);
});

test('an edit that changes nothing returns the same design', () => {
  const d = frozen(2, 2);
  assert.equal(rotateBlocks(d, []), d);
  assert.equal(setBackFabric(d, 'b0'), d);
  assert.equal(setBlockMm(d, d.blockMm), d);
  assert.equal(setPartFabric(d, [0], 'plain', [0], 'b0'), d);
  assert.equal(resize(d, 2, 2), d);
});

test('cells covered by a large block are not edited', () => {
  const d = deepFreeze(setSpan(grid(3, 3), 0, 2));
  assert.deepEqual(rotateBlocks(d, [1, 3, 4]), d);
});

test('mirror toggles', () => {
  const d = frozen(1, 1);
  const n = flipBlocks(d, [0]);
  assert.equal(n.blocks[0].flip, true);
  assert.equal('flip' in flipBlocks(n, [0]).blocks[0], false);
});

test('fabric: only the chosen parts of blocks of the same pattern', () => {
  const d = grid(2, 1, { pattern: 'four' });
  d.blocks[1] = newBlockData('plain');
  deepFreeze(d);
  const n = setPartFabric(d, [0, 1], 'four', [0, 3], 'b5');
  assert.deepEqual(n.blocks[0].fabrics, ['b5', 'b0', 'b0', 'b5']);
  assert.equal(n.blocks[1], d.blocks[1]);
});

test('pattern: new parts in the role colours; turn, mirror and size are kept', () => {
  const d = deepFreeze(setSpan(grid(3, 3), 0, 2));
  const d2 = deepFreeze({ ...d, blocks: d.blocks.map((b, i) => (i === 0 ? { ...b, rot: 3, flip: true } : b)) });
  const n = setPattern(d2, [0], 'hst', ['b7', 'b8', 'b9']);
  assert.equal(n.blocks[0].pattern, 'hst');
  assert.deepEqual([n.blocks[0].rot, n.blocks[0].flip, n.blocks[0].span], [3, true, 2]);
  assert.deepEqual(n.blocks[0].fabrics, ['b8', 'b7']);
});

test('copy: the copy keeps its own size', () => {
  const d = deepFreeze(setSpan(grid(3, 3, { pattern: 'plain' }), 4, 2));
  const src = { ...newBlockData('hst', 'b2'), rot: 2 };
  const n = copyBlock(d, src, [0, 4]);
  assert.deepEqual([n.blocks[0].pattern, n.blocks[0].rot, n.blocks[0].span], ['hst', 2, undefined]);
  assert.deepEqual([n.blocks[4].pattern, n.blocks[4].span], ['hst', 2]);
});

test('fussy cut: set, then cleared', () => {
  const d = frozen(1, 1, { pattern: 'hst' });
  const n = setFussy(d, [0], 'hst', 1, [0.25, 0.5]);
  assert.deepEqual(n.blocks[0].fussy, { 1: [0.25, 0.5] });
  assert.equal('fussy' in setFussy(n, [0], 'hst', 1, null).blocks[0], false);
});

test('block size: span through the edit', () => {
  const n = setBlockSpan(frozen(4, 4), 5, 2);
  assert.equal(n.blocks[5].span, 2);
  assert.deepEqual(
    [6, 9, 10].map(i => n.blocks[i].under),
    [5, 5, 5],
  );
});

test('sashing, borders, quilting, block size, backing', () => {
  const d = frozen(2, 2);
  assert.deepEqual(setSashing(d, { mm: 50 }).sashing, { mm: 50, fabric: 'b0', corner: 'b3', border: false });
  assert.equal(setSashing(d, { mm: -3 }).sashing.mm, 0);
  const b = addBorder(d, { type: 'plain', mm: 40, fabrics: ['b1'] });
  assert.equal(b.borders.length, 1);
  assert.equal('quilting' in setQuilting(setQuilting(d, 'fans'), 'ditch'), false);
  assert.equal(setBlockMm(d, 300).blockMm, 300);
  assert.equal(setBackFabric(d, 'b4').backFabric, 'b4');
});

test('resize keeps blocks in place and copies the nearest one into new cells', () => {
  const d = grid(2, 1);
  d.blocks[1] = newBlockData('hst');
  deepFreeze(d);
  const n = resize(d, 3, 2);
  assert.deepEqual([n.cols, n.rows, n.blocks.length], [3, 2, 6]);
  assert.equal(n.blocks[0], d.blocks[0]);
  assert.deepEqual(
    n.blocks.map(b => b.pattern),
    ['plain', 'hst', 'hst', 'plain', 'hst', 'hst'],
  );
  assert.equal(resize.mirror, false);
});

test('symmetry: a changed block is copied to its partners, mirrored', () => {
  const d = frozen(4, 1, { sym: 'lr' });
  const n = withSymmetry(rotateBlocks(d, [0]), [0]);
  assert.deepEqual([n.blocks[3].rot, n.blocks[3].flip], [1, true]);
  assert.equal(n.blocks[1], d.blocks[1]);
});

test('turning a symmetry on mirrors the top-left part straight away', () => {
  const d = grid(4, 4);
  d.blocks[0] = { ...newBlockData('hst'), rot: 1 };
  deepFreeze(d);
  const n = setSymmetry(d, 'both');
  assert.equal(n.sym, 'both');
  assert.deepEqual(
    [3, 12, 15].map(i => n.blocks[i].pattern),
    ['hst', 'hst', 'hst'],
  );
  assert.equal('sym' in setSymmetry(n, 'off'), false);
});

test('border edits: add, change, move, fabric slots, remove', () => {
  const deepFreeze = o => (
    Object.values(o).forEach(v => v && typeof v === 'object' && deepFreeze(v)),
    Object.freeze(o)
  );
  const d = deepFreeze(
    addBorder(addBorder(frozen(2, 2), { type: 'plain', mm: 40, fabrics: ['b1'] }), {
      type: 'piano',
      mm: 60,
      fabrics: ['b2'],
    }),
  );
  assert.equal(updateBorder(d, 0, { mm: 50 }).borders[0].mm, 50);
  assert.equal(updateBorder(d, 0, { mm: 50 }).borders[1], d.borders[1]); // the other border is shared
  assert.deepEqual(
    moveBorder(d, 0, 1).borders.map(b => b.type),
    ['piano', 'plain'],
  );
  assert.equal(moveBorder(d, 1, 1), d); // already outermost
  assert.deepEqual(setBorderFabric(d, 0, 2, 'b5').borders[0].fabrics, ['b1', 'b1', 'b5']);
  assert.deepEqual(
    removeBorder(d, 0).borders.map(b => b.type),
    ['piano'],
  );
});
