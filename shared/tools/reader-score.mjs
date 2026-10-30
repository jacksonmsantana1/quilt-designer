// How well the block reader (src/block-reader.js) reads pictures of the app's own blocks, where the right answer
// is known:
//   node shared/tools/reader-score.mjs            every block, plain and roughened (noise, seam lines, blur)
// For each block: the grid size found, and the share of the block the answer gets right, drawn back and compared
// with the block's true pieces (the reader's fabrics matched to the true colour roles).
import { PATTERNS } from '../src/patterns.js';
import { picture, scoreRead } from '../tests/reader-pictures.mjs';

const rows = [];
for (const key of Object.keys(PATTERNS)) {
  const plain = scoreRead(key, picture(key)),
    rough = scoreRead(key, picture(key, { noise: 14, seams: true, blur: true }));
  rows.push([key, plain.n, plain.right, rough.right]);
}
rows.sort((a, b) => a[3] - b[3]);
const pct = v => (v * 100).toFixed(1).padStart(5) + '%';
console.log('block'.padEnd(16), 'n', ' plain ', ' rough');
for (const [k, n, a, b] of rows) console.log(k.padEnd(16), String(n).padStart(2), pct(a), pct(b));
const avg = i => rows.reduce((s, r) => s + r[i], 0) / rows.length;
console.log(
  `\naverage: plain ${pct(avg(2))}, rough ${pct(avg(3))} · blocks read 98% or better: ${rows.filter(r => r[3] >= 0.98).length} of ${rows.length}`,
);
