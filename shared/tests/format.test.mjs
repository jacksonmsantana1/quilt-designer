// The saved design format: upgrading old saves, repairing damaged ones, and designs from newer versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { FORMAT_VERSION, MIGRATIONS, readDesign, readDesignOrDefault } from '@quilt/shared/format.js';
import { defaultDesign } from '@quilt/shared/design.js';
import { normalizeSpans } from '@quilt/shared/geometry.js';

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
    assert.equal(r.design.blocks.length, r.design.cols * r.design.rows, f);
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
