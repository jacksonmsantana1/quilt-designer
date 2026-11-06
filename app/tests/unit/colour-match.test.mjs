import test from 'node:test';
import assert from 'node:assert/strict';
import {
  colourMatch,
  fabricColours,
  hslToRgb,
  rgbToHsl,
  shareAmounts,
  COLOUR_FAMILIES,
  colourFamily,
  colourOrder,
  fabricFamilies,
} from '../../src/core/colour-match.js';

/** An RGBA picture: `parts` of [rgb, how many pixels]. */
const picture = parts => {
  const px = [];
  for (const [rgb, n] of parts) for (let i = 0; i < n; i++) px.push(...rgb, 255);
  return Uint8ClampedArray.from(px);
};
const CREAM = [239, 229, 207],
  TEAL = [63, 107, 107],
  RED = [195, 36, 58];

test('a fabric’s main colours and their shares, largest first; near shades joined', () => {
  const c = fabricColours(
    picture([
      [CREAM, 600],
      [[241, 231, 209], 100], // a near shade of cream: joined into it
      [TEAL, 300],
    ]),
  );
  assert.equal(c.length, 2);
  assert.ok(Math.abs(c[0].share - 0.7) < 0.01);
  assert.ok(Math.abs(c[1].share - 0.3) < 0.01);
  assert.deepEqual(c[1].rgb, TEAL);
  assert.deepEqual(fabricColours(new Uint8ClampedArray(0)), []);
});

test('the match: the right colours in the right amounts rank first', () => {
  const tealStripe = fabricColours(
      picture([
        [CREAM, 600],
        [TEAL, 400],
      ]),
    ),
    cream = fabricColours(picture([[CREAM, 1000]])),
    red = fabricColours(picture([[RED, 1000]]));
  const want = [
    { rgb: CREAM, amount: 60 },
    { rgb: TEAL, amount: 40 },
  ];
  const s = colourMatch(want, tealStripe);
  assert.ok(s > 0.95, `teal stripe ${s}`);
  assert.ok(colourMatch(want, cream) < 0.65 && colourMatch(want, cream) > 0.55, 'only the cream part');
  assert.ok(colourMatch(want, red) < 0.05);
  // a shade near teal still counts, in part
  const nearTeal = fabricColours(
    picture([
      [CREAM, 600],
      [[75, 120, 118], 400],
    ]),
  );
  assert.ok(colourMatch(want, nearTeal) > 0.75 && colourMatch(want, nearTeal) < s);
});

test('amounts: moving one shares the rest between the others, always 100 in all', () => {
  assert.deepEqual(shareAmounts([60, 30, 10], 0), [60, 30, 10]);
  assert.deepEqual(shareAmounts([80, 30, 10], 0), [80, 15, 5]);
  assert.deepEqual(shareAmounts([50, 50], -1), [50, 50]);
  assert.deepEqual(shareAmounts([0, 0, 100], 2), [0, 0, 100]);
  assert.deepEqual(shareAmounts([10], 0), [100], 'one colour is all of it');
  for (const a of [shareAmounts([33, 33, 33], 1), shareAmounts([70, 20], -1), shareAmounts([10], 0)])
    assert.equal(
      a.reduce((s, v) => s + v, 0),
      100,
      String(a),
    );
});

test('hsl and rgb round trip', () => {
  for (const rgb of [CREAM, TEAL, RED, [0, 0, 0], [255, 255, 255]]) {
    const { h, s, l } = rgbToHsl(rgb);
    hslToRgb(h, s, l).forEach((v, i) => assert.ok(Math.abs(v - rgb[i]) <= 1, `${rgb} -> ${v}`));
  }
});

test('colour families: what a quilter would call them', () => {
  const named = {
    red: [190, 30, 40],
    orange: [235, 130, 40],
    yellow: [240, 210, 70],
    green: [50, 140, 80],
    blue: [40, 80, 170],
    purple: [120, 60, 170],
    pink: [240, 150, 190],
    brown: [110, 70, 40],
    grey: [130, 130, 130],
    black: [15, 15, 18],
    white: [250, 247, 240],
  };
  for (const [family, rgb] of Object.entries(named)) assert.equal(colourFamily(rgb), family);
  // every family has a colour to show, which is of that family
  for (const f of COLOUR_FAMILIES) assert.equal(colourFamily(f.rgb), f.key);
});

test('a fabric is in the family of its largest colour, and of any other that covers a fair part of it', () => {
  const colours = [
    { rgb: [190, 30, 40], share: 0.6 },
    { rgb: [40, 80, 170], share: 0.3 },
    { rgb: [50, 140, 80], share: 0.1 },
  ];
  assert.deepEqual(fabricFamilies(colours), ['red', 'blue']);
  assert.deepEqual(fabricFamilies([]), []);
});

test('sorting by colour puts like with like, and a fabric with no colours last', () => {
  const of = rgb => colourOrder([{ rgb, share: 1 }]);
  assert.ok(of([190, 30, 40]) < of([40, 80, 170]));
  assert.ok(of([40, 80, 170]) < of([250, 247, 240]));
  assert.equal(colourOrder([]), Infinity);
});
