// Blocks drawn in the block editor: their key, the checks, and quilts that carry them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { checkDrawn, drawnKey, readDrawn, DRAWN_FAMILY } from '@quilt/shared/drawn-blocks.js';
import { readDesign } from '@quilt/shared/format.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';

const fixture = () =>
  JSON.parse(fs.readFileSync(new URL('./fixtures/designs/v8-drawn-block.json', import.meta.url), 'utf8'));
const pinwheel = { label: 'Pinwheel of mine', n: 2, rows: '0/1 1\\0\n0\\1 1/0' };

test('the key comes from the drawing, not its name or spacing', () => {
  const k = drawnKey(pinwheel);
  assert.match(k, /^my[0-9a-f]{12}$/);
  assert.equal(drawnKey({ ...pinwheel, label: 'Another name' }), k);
  assert.equal(drawnKey({ ...pinwheel, rows: '  0/1   1\\0 \n 0\\1 1/0  ' }), k);
  assert.notEqual(drawnKey({ ...pinwheel, rows: '0/1 1\\0\n0\\1 1/2' }), k);
});

test('a drawing must be n × n cells the notation reads, with no holes', () => {
  assert.deepEqual(checkDrawn(pinwheel), pinwheel);
  assert.equal(checkDrawn({ ...pinwheel, label: '  ' }).label, 'My block');
  assert.equal(checkDrawn({ ...pinwheel, label: 'x'.repeat(99) }).label.length, 60);
  for (const bad of [
    null,
    { ...pinwheel, n: 3 }, // wrong number of rows
    { ...pinwheel, rows: '0 1 1\n0 1' }, // a row too long
    { ...pinwheel, rows: '0 7\n0 1' }, // colour role out of range
    { ...pinwheel, rows: '0 x\n0 1' }, // a hole
    { ...pinwheel, rows: '0 -\n| 1' }, // a piece that doesn't fit
    { ...pinwheel, n: 13 },
    { ...pinwheel, rows: 5 },
  ])
    assert.equal(checkDrawn(bad), null, JSON.stringify(bad));
});

test('readDrawn keeps good drawings under their own key and makes them patterns', () => {
  const k = drawnKey(pinwheel);
  const r = readDrawn({
    [k]: pinwheel,
    mywrongkey00000: pinwheel,
    [drawnKey({ n: 1, rows: 'x' })]: { n: 1, rows: 'x' },
  });
  assert.deepEqual(Object.keys(r.drawn), [k]);
  assert.equal(r.lost, 2);
  assert.equal(PATTERNS[k].family, DRAWN_FAMILY);
  assert.equal(PATTERNS[k].label, 'Pinwheel of mine');
  assert.equal(partsOf(k).length, 8);
  // renaming the same drawing renames the pattern; one of the app's own blocks is never replaced
  readDrawn({ [k]: { ...pinwheel, label: 'Renamed' } });
  assert.equal(PATTERNS[k].label, 'Renamed');
  assert.deepEqual(readDrawn(undefined), { drawn: {}, lost: 0 });
  assert.equal(readDrawn('nonsense').lost, 1);
});

test('a quilt with a drawn block opens with it, unchanged', () => {
  const raw = fixture(),
    r = readDesign(raw);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, raw);
  const key = Object.keys(raw.drawn)[0];
  assert.equal(r.design.blocks[0].pattern, key);
  assert.equal(partsOf(key).length, raw.blocks[0].fabrics.length);
});

test('a quilt whose drawing is damaged: the drawing is dropped and its blocks become plain squares', () => {
  const raw = fixture(),
    key = Object.keys(raw.drawn)[0];
  delete PATTERNS[key]; // as on a device that never saw this drawing
  const r = readDesign({ ...raw, drawn: { [key]: { ...raw.drawn[key], rows: 'nonsense' } } });
  assert.equal('drawn' in r.design, false);
  assert.equal(r.design.blocks[0].pattern, 'plain');
  assert.ok(r.problems.includes('1 drawn block could not be read and was left out.'));
  assert.ok(r.problems.some(p => p.includes('unknown pattern')));
});
