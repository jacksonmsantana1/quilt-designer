// Millimetres or inches: how a length is written and how a typed number is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dims,
  eighthsOf,
  exact,
  fromInput,
  getUnit,
  sharesOf,
  inches,
  inputRange,
  len,
  num,
  onUnitChange,
  setUnit,
  toInput,
} from '../../src/core/units.js';
import { quiltMm } from '@quilt/shared/geometry.js';
import { newBlock } from '@quilt/shared/design.js';

test('a square cut in two or four can be a share of one per block', () => {
  assert.equal(sharesOf(1), '1');
  assert.equal(sharesOf(0.5), '½');
  assert.equal(sharesOf(0.25), '¼');
  assert.equal(sharesOf(1.5), '1½');
  assert.equal(sharesOf(2), '2');
  assert.equal(sharesOf(1 / 3), '1');
});

test('millimetres (the start): whole numbers with "mm"', () => {
  assert.equal(getUnit(), 'mm');
  assert.equal(len(165.4), '165 mm');
  assert.equal(num(300), '300');
  assert.equal(dims([900, 300]), '900 × 300 mm');
  assert.equal(toInput(458), 458);
  assert.equal(fromInput(458), 458);
  assert.deepEqual(inputRange(10, 400), { min: 10, max: 400, step: 1 });
});

test('inches: to the nearest eighth, written with fractions', () => {
  assert.equal(inches(25.4), '1');
  assert.equal(inches(165.1), '6½');
  assert.equal(inches(300), '11¾'); // 11.81
  assert.equal(inches(3.2), '⅛');
  assert.equal(inches(0), '0');
  assert.equal(inches(12.7), '½');
  assert.equal(inches(914.4), '36');
});

test('changing the unit tells the listeners, once, and only when it changes', () => {
  let n = 0;
  onUnitChange(() => n++);
  setUnit('in');
  setUnit('in');
  setUnit('cm'); // not a unit: ignored
  assert.equal(n, 1);
  assert.equal(getUnit(), 'in');
  assert.equal(len(165.1), '6½ in');
  assert.equal(dims([900, 300]), '35⅜ × 11¾ in');
  assert.equal(dims([6, 12], ' to '), '¼ to ½ in');
  setUnit('mm');
  assert.equal(n, 2);
});

test('number boxes in inches: a sixteenth shows as itself, other lengths to two decimals, typed back to whole mm', () => {
  setUnit('in');
  assert.equal(toInput(152), 6, '152 mm is the 6 inches somebody typed');
  assert.equal(toInput(165), 6.5);
  assert.equal(toInput(300), 11.8125, '300 mm is 11 and 13 sixteenths');
  assert.equal(toInput(307), 12.09, 'not near a sixteenth: two decimals');
  assert.equal(fromInput(6), 152);
  assert.equal(fromInput(11.8125), 300);
  assert.equal(fromInput(toInput(458)), 458, 'what is shown reads back the same');
  assert.deepEqual(inputRange(10, 400), { min: 0.5, max: 15.625, step: 0.125 });
  setUnit('mm');
});

test('the inch boxes: whole inches and eighths, halves (from a sixteenth in the box) going down as when written', () => {
  assert.deepEqual(eighthsOf(6.5), [6, 4]);
  assert.deepEqual(eighthsOf(11.8125), [11, 6]); // 300 mm: written 11¾ in
  assert.deepEqual(eighthsOf(11.9), [11, 7]);
  assert.deepEqual(eighthsOf(2.99), [3, 0]);
  assert.deepEqual(eighthsOf(0), [0, 0]);
  assert.deepEqual(eighthsOf(NaN), [0, 0]);
  assert.deepEqual(eighthsOf(-1), [0, 0]);
});

test('in inches, sizes add up from the inches typed, not from their whole millimetres', () => {
  // 4 × 5 blocks of 10 in, 2 in sashing, borders of 2 in and 4 in: 58 × 70 in, not 58⅛ × 70⅛
  const d = {
    v: 1,
    cols: 4,
    rows: 5,
    blockMm: 254,
    backFabric: 'b0',
    blocks: Array.from({ length: 20 }, () => newBlock('plain', ['b0'])),
    sashing: { mm: 51, fabric: 'b1', corner: 'b3' },
    borders: [
      { type: 'plain', mm: 51, fabrics: ['b0', 'b0'] },
      { type: 'plain', mm: 102, fabrics: ['b1', 'b1'] },
    ],
  };
  setUnit('in');
  const q = quiltMm(exact(d));
  assert.equal(len(q.W), '58 in');
  assert.equal(len(q.H), '70 in');
  assert.equal(exact(d), exact(d), 'kept while the design is the same');
  assert.equal(d.sashing.mm, 51, 'the design itself is not changed');
  setUnit('mm');
  assert.equal(exact(d), d, 'in millimetres, the design as it is');
});
