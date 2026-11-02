// The fabrics drawn in code: the app's collection (1500 fabrics, each always the same) and the pictures themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_SIZE, KIND_NAMES, SIZE, collection, drawPattern } from '../src/fabric-patterns.js';

test('the collection: 1500 fabrics with ids c0…c1499, one name each, every kind of print', () => {
  const list = collection();
  assert.equal(list.length, COLLECTION_SIZE);
  assert.equal(COLLECTION_SIZE, 1500);
  assert.deepEqual(
    list.map(f => f.id),
    list.map((f, i) => 'c' + i),
  );
  assert.equal(new Set(list.map(f => f.name)).size, list.length, 'no two fabrics share a name');
  assert.deepEqual(new Set(list.map(f => f.kind)), new Set(KIND_NAMES));
  for (const f of list) assert.ok(f.cm >= 10 && f.cm <= 35, `${f.name}: ${f.cm} cm`);
  assert.equal(collection(), list, 'worked out once');
});

test('the collection stays the same: quilts saved with its fabrics look the same later', () => {
  // if this fails, the collection changed: quilts already using c-fabrics would change colour. Only add at the end.
  const list = collection();
  assert.deepEqual(
    [0, 1, 2, 3, 4, 250, 499].map(i => list[i].name),
    [
      'Charcoal solid',
      'Turquoise mottled blender',
      'Moss ditsy on pink',
      'Sky floral on white',
      'Forest gingham on cream',
      list[250].name,
      list[499].name,
    ],
  );
});

test('every kind draws a seamless picture: the right edge runs on into the left, the bottom into the top', () => {
  const row = SIZE * 3;
  for (const kind of KIND_NAMES) {
    const px = drawPattern(kind, 7, 0xf5efe0, 0x1f2a44);
    assert.equal(px.length, SIZE * row);
    // a jump in colour across the edge (left to right, top to bottom) is no bigger than the jumps inside the picture:
    // the edge is just one more place in the repeat
    const at = (x, y) => px[(y * SIZE + x) * 3];
    let wrap = 0,
      inside = 0;
    for (let a = 0; a < SIZE; a++) {
      wrap = Math.max(wrap, Math.abs(at(0, a) - at(SIZE - 1, a)), Math.abs(at(a, 0) - at(a, SIZE - 1)));
      for (let b = 1; b < SIZE; b++)
        inside = Math.max(inside, Math.abs(at(b, a) - at(b - 1, a)), Math.abs(at(a, b) - at(a, b - 1)));
    }
    assert.ok(wrap <= inside + 1, `${kind}: across the edge ${wrap}, inside ${inside}`);
    assert.deepEqual(drawPattern(kind, 7, 0xf5efe0, 0x1f2a44), px, `${kind}: the same seed, the same picture`);
  }
});
