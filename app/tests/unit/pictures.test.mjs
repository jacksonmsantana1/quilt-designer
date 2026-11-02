// The realistic pictures kept on the device, by the fingerprint of the quilt they show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEEP, createPictures } from '../../src/storage/pictures.js';
import { quiltSig } from '../../src/core/quilt-sig.js';
import { defaultDesign } from '@quilt/shared/design.js';

const size = { width: 3, height: 2 };
const blob = text => new Blob([text], { type: 'image/jpeg' });

test('a picture is kept under its quilt, and found again', async () => {
  const p = createPictures(null); // no IndexedDB: kept in memory
  await p.load();
  assert.equal(p.has('q1'), false);
  assert.equal(await p.get('q1'), null);
  await p.put('q1', blob('a'), size);
  assert.equal(p.has('q1'), true);
  const rec = await p.get('q1');
  assert.equal(await rec.blob.text(), 'a');
  assert.equal(rec.width, 3);
});

test('only the newest pictures are kept', async () => {
  const p = createPictures(null);
  for (let i = 0; i < KEEP + 2; i++) {
    await p.put(`q${i}`, blob(String(i)), size);
    await new Promise(done => setTimeout(done, 2)); // (each its own moment)
  }
  assert.equal(p.has('q0'), false);
  assert.equal(p.has('q1'), false);
  assert.equal(p.has('q2'), true);
  assert.equal(await p.get('q0'), null);
  assert.equal(p.has(`q${KEEP + 1}`), true);
});

test('the same quilt has the same fingerprint, whatever the order of its keys; a changed one another', () => {
  const d = defaultDesign(),
    reordered = Object.fromEntries(Object.entries(d).reverse());
  assert.equal(quiltSig(reordered), quiltSig(d));
  assert.notEqual(quiltSig({ ...d, cols: d.cols + 1 }), quiltSig(d));
});
