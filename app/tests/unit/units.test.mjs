// Millimetres or inches: how a length is written and how a typed number is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dims,
  fromInput,
  getUnit,
  inches,
  inputRange,
  len,
  num,
  onUnitChange,
  setUnit,
  toInput,
} from '../../src/core/units.js';

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
