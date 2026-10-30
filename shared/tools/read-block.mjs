// Reads a picture of a quilt block (PNG) and prints it in the grid notation:
//   node shared/tools/read-block.mjs block.png
// Also writes block.read.png beside it: the block as found (left) and the answer drawn back in the fabrics found
// (right), cells it is unsure of outlined in red.
import fs from 'node:fs';
import { decodePng, encodePng } from './png.mjs';
import { S, clusterAt, readBlock } from '../src/block-reader.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node shared/tools/read-block.mjs <picture.png>');
  process.exit(1);
}
const img = decodePng(fs.readFileSync(file));
const r = readBlock(img);

console.log(`grid ${r.n} × ${r.n} · answer matches ${(r.match * 100).toFixed(1)}% of the picture`);
console.log(
  `fabrics: ${r.fabrics.map((c, i) => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')} (role ${r.role[i]})`).join(', ')}`,
);
console.log('\n' + r.rows.replace(/^/gm, '      ') + '\n');
const unsure = r.cells.map((m, i) => [m, i]).filter(([m]) => m < 0.9);
if (unsure.length)
  console.log(
    'unsure: ' +
      unsure
        .map(([m, i]) => `row ${Math.floor(i / r.n) + 1}, column ${(i % r.n) + 1} (${Math.round(m * 100)}%)`)
        .join('; '),
  );

// the picture: what was read | the answer, each S × S
const W = 2 * S + 12,
  out = new Uint8Array(W * S * 3).fill(255);
const { x0, y0, x1, y1 } = r.box;
const size = S / r.n;
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    const sx = Math.min(img.width - 1, Math.floor(x0 + ((x + 0.5) / S) * (x1 - x0))),
      sy = Math.min(img.height - 1, Math.floor(y0 + ((y + 0.5) / S) * (y1 - y0)));
    out.set(img.data.subarray((sy * img.width + sx) * 3, (sy * img.width + sx) * 3 + 3), (y * W + x) * 3);
    const ci = Math.min(r.n - 1, Math.floor(x / size)),
      cj = Math.min(r.n - 1, Math.floor(y / size)),
      p = r.pieceAt[cj * r.n + ci];
    let col = r.fabrics[clusterAt(p, x, y, size)];
    // the outline of each piece (not of the cells inside it)
    const u = ((x + 0.5) / size - p.x) / p.w,
      v = ((y + 0.5) / size - p.y) / p.h,
      t = 0.03 / Math.max(p.w, p.h);
    const border = u < t || u > 1 - t || v < t || v > 1 - t;
    if (border) col = r.cells[cj * r.n + ci] < 0.9 ? [220, 30, 30] : [90, 90, 90];
    out.set(col, (y * W + x + S + 12) * 3);
  }
const dest = file.replace(/\.png$/i, '') + '.read.png';
fs.writeFileSync(dest, encodePng(W, S, out));
console.log(`side by side: ${dest}`);
