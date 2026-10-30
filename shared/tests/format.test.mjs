// The saved design format: upgrading old saves, repairing damaged ones, and designs from newer versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { FORMAT_VERSION, MIGRATIONS, readDesign, readDesignOrDefault } from '@quilt/shared/format.js';
import { defaultDesign } from '@quilt/shared/design.js';
import { cellCount, normalizeSpans } from '@quilt/shared/geometry.js';

const DIR = new URL('./fixtures/designs/', import.meta.url);
const text = f => fs.readFileSync(new URL(f, DIR), 'utf8');
const deepFreeze = o => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

test('there is one migration per version', () => {
  assert.equal(MIGRATIONS.length, FORMAT_VERSION);
});

test('each migration is pure and moves a design up exactly one version', () => {
  const old = deepFreeze(JSON.parse(text('v0-before-block-sizes.json')));
  let d = old;
  MIGRATIONS.forEach((m, v) => {
    const next = m(deepFreeze(d)); // throws if it changes its input
    assert.equal(next.v, v + 1);
    d = next;
  });
});

test('every saved example opens at the current version', () => {
  for (const f of fs.readdirSync(DIR)) {
    const r = readDesign(text(f));
    assert.ok(r, f);
    if (!r.newer) assert.equal(r.design.v, FORMAT_VERSION, f);
    assert.equal(r.design.blocks.length, cellCount(r.design), f);
  }
});

test('good saves from before versions open unchanged, with no problems', () => {
  for (const f of ['v0-every-feature.json', 'v0-medallion-sampler.json', 'v0-photo-medallion.json']) {
    const raw = JSON.parse(text(f)),
      r = readDesign(raw);
    assert.equal(r.from, 0, f);
    assert.deepEqual(r.problems, [], f);
    assert.deepEqual(r.design, { ...normalizeSpans(raw), v: FORMAT_VERSION }, f);
  }
});

test('sashing without cornerstones is kept; with them, nothing extra is stored', () => {
  const raw = JSON.parse(text('v2-sashing-without-cornerstones.json')),
    r = readDesign(raw);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, { ...raw, v: FORMAT_VERSION }); // upgraded, nothing else changed
  const on = readDesign({ ...raw, sashing: { ...raw.sashing, cornerstones: true } });
  assert.equal('cornerstones' in on.design.sashing, false); // on is the default
});

test('on point: kept with its blocks between; a wrong count or setting is repaired and reported', () => {
  const raw = JSON.parse(text('v4-on-point.json')),
    r = readDesign(raw);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, { ...raw, v: FORMAT_VERSION });
  assert.equal(r.design.blocks.length, 9 + 4);
  // a block between the others missing: filled in, like any missing block
  const short = readDesign({ ...raw, blocks: raw.blocks.slice(0, 12) });
  assert.equal(short.design.blocks.length, 13);
  assert.deepEqual(short.problems, ['1 missing block was filled with a plain square.']);
  // an unknown layout: straight again, and the blocks between are left out
  const odd = readDesign({ ...raw, setting: 'sideways' });
  assert.equal('setting' in odd.design, false);
  assert.equal(odd.design.blocks.length, 9);
  assert.ok(odd.problems.includes('The layout went back to straight.'));
});

test('on point with a large block (version 5): kept as it is', () => {
  const raw = JSON.parse(text('v5-on-point-large-block.json')),
    r = readDesign(raw);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, { ...raw, v: FORMAT_VERSION });
});

test('on point with a symmetry (version 6): kept as it is', () => {
  const raw = JSON.parse(text('v6-on-point-symmetry.json')),
    r = readDesign(raw);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, { ...raw, v: FORMAT_VERSION });
});

test('a hexagon mosaic (version 7): kept as it is, its blocks too', () => {
  const raw = JSON.parse(text('v7-hexagon-mosaic.json')),
    r = readDesign(raw);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, { ...raw, v: FORMAT_VERSION });
  assert.equal(r.design.mosaic.fabrics.length, 28);
});

test('a cornerstone block is kept; an unreadable one is taken off and reported', () => {
  const raw = JSON.parse(text('v3-cornerstone-block.json')),
    r = readDesign(raw);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, { ...raw, v: FORMAT_VERSION });
  const bad = readDesign({ ...raw, sashing: { ...raw.sashing, cornerBlock: { pattern: 'no-such-pattern' } } });
  assert.equal('cornerBlock' in bad.design.sashing, false);
  assert.deepEqual(bad.problems, ['The cornerstone block could not be read and was taken off.']);
  const short = readDesign({
    ...raw,
    sashing: { ...raw.sashing, cornerBlock: { pattern: 'four', rot: 0, fabrics: [] } },
  });
  assert.equal(short.design.sashing.cornerBlock.fabrics.length, 4); // missing fabrics filled in
  assert.deepEqual(short.problems, ['The cornerstone block was repaired.']);
});

test('the oldest saves get a block size and a backing fabric', () => {
  const r = readDesign(text('v0-before-block-sizes.json'));
  assert.equal(r.design.blockMm, Math.round(2290 / 3));
  assert.equal(r.design.backFabric, 'b0');
  assert.deepEqual(r.problems, []);
});

test('opening never changes the input', () => {
  const raw = deepFreeze(JSON.parse(text('broken.json')));
  assert.doesNotThrow(() => readDesign(raw));
});

test('a damaged save is repaired, and every repair is reported', () => {
  const r = readDesign(text('broken.json'));
  const d = r.design;
  assert.equal(d.blocks.length, 4);
  assert.equal(d.blocks[0].pattern, 'plain'); // unknown pattern
  assert.deepEqual(d.blocks[0].fabrics, ['b5']); // keeps its first fabric
  assert.equal(d.blocks[1].rot, 3); // 7 quarter turns
  assert.equal(d.blocks[1].fabrics.length > 1, true); // missing fabrics filled in
  assert.equal('span' in d.blocks[2], false);
  assert.equal('under' in d.blocks[2], false);
  assert.equal('fussy' in d.blocks[2], false);
  assert.equal(d.blocks[3].pattern, 'plain'); // missing cell
  assert.equal(d.blockMm, 1000);
  assert.equal(d.backFabric, 'b0');
  assert.equal('sym' in d, false);
  assert.equal('quilting' in d, false);
  assert.equal('sashing' in d, false);
  assert.deepEqual(d.borders, [{ type: 'plain', mm: 10, fabrics: ['b1', 'b0'] }]);
  assert.equal(r.problems.length, 11, r.problems.join('\n'));
});

test('a design from a newer version is opened as it is and marked', () => {
  const r = readDesign(text('newer.json'));
  assert.equal(r.newer, true);
  assert.equal(r.design.v, 99);
  assert.deepEqual(r.design.future, { x: 1 }); // fields it doesn't know are kept
});

test('things that are not quilts', () => {
  for (const x of ['', 'not json', '[]', '"hello"', '{}', '{"cols":2}', null, undefined, 42])
    assert.equal(readDesign(/** @type {any} */ (x)), null, String(x));
  assert.deepEqual(readDesignOrDefault('nope').design, defaultDesign());
});

test('the default design is current and needs no repairs', () => {
  const r = readDesign(defaultDesign());
  assert.equal(r.from, FORMAT_VERSION);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.design, defaultDesign());
});
