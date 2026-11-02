// Reads shaded diagrams of quilt blocks (flat greys or colours, a line round every cell: pattern-book pictures) and
// writes ONE web page to check them: each diagram beside what was read, with clicks to fix a fabric, join or split
// squares along a line, or cut a square. Nothing to install: open the page, fix, press "Copy corrections" and paste
// them in the chat.
//
//   node shared/tools/diagram-review.mjs sheet.json [review.html]
//
// sheet.json:  { "page": "C:/path/page.png", "scale": 3, "blocks": [ { "name": "10 Cogwheels", "box": [x, y, w, h] }, ... ] }
//   page   a PNG (or webp/jpg: ffmpeg turns it into one)      box    the diagram's place in the page, in pixels
//   scale  how much the crop is enlarged before reading (default 3: thin lines need room)
// The reading is shared/src/block-reader.js (colours, printed lines, texture); the grid size is found by it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { decodePng, encodePng } from './png.mjs';
import { readBlock } from '../src/block-reader.js';

const [sheetFile, outFile = 'diagram-review.html'] = process.argv.slice(2);
if (!sheetFile) {
  console.error('Usage: node shared/tools/diagram-review.mjs sheet.json [review.html]');
  process.exit(1);
}
const sheet = JSON.parse(fs.readFileSync(sheetFile, 'utf8')),
  scale = sheet.scale || 3;

let file = sheet.page;
if (!/\.png$/i.test(file)) {
  const tmp = path.join(os.tmpdir(), 'diagram-review-page.png');
  if (spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, tmp]).status !== 0)
    throw new Error('ffmpeg could not read ' + file);
  file = tmp;
}
const page = decodePng(fs.readFileSync(file)),
  ch = page.data.length / (page.width * page.height);
const rgbAt = (x, y) => {
  const i = (y * page.width + x) * ch;
  return ch >= 3 ? [page.data[i], page.data[i + 1], page.data[i + 2]] : [page.data[i], page.data[i], page.data[i]];
};

/** The crop of the page as RGB, and the same enlarged (bilinear) to read. */
function crop([bx, by, bw, bh]) {
  const rgb = new Uint8Array(bw * bh * 3);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) rgb.set(rgbAt(bx + x, by + y), (y * bw + x) * 3);
  const W = bw * scale,
    H = bh * scale,
    big = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / scale - 0.5)),
        fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / scale - 0.5)),
        x0 = Math.floor(fx),
        y0 = Math.floor(fy),
        x1 = Math.min(bw - 1, x0 + 1),
        y1 = Math.min(bh - 1, y0 + 1),
        tx = fx - x0,
        ty = fy - y0;
      for (let k = 0; k < 3; k++) {
        const a = rgb[(y0 * bw + x0) * 3 + k] * (1 - tx) + rgb[(y0 * bw + x1) * 3 + k] * tx,
          b = rgb[(y1 * bw + x0) * 3 + k] * (1 - tx) + rgb[(y1 * bw + x1) * 3 + k] * tx;
        big[(y * W + x) * 3 + k] = Math.round(a * (1 - ty) + b * ty);
      }
    }
  return { rgb, big: { width: W, height: H, data: big, channels: 3 } };
}

const blocks = sheet.blocks.map(b => {
  const [, , bw, bh] = b.box,
    { rgb, big } = crop(b.box),
    r = readBlock(big),
    n = r.n;
  // the model: a square per cell (whole or cut), and which neighbours are joined into one piece
  const cells = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ shape: 'S', roles: [0], unsure: false })),
    ),
    hj = Array.from({ length: n }, () => Array(n).fill(false)),
    vj = Array.from({ length: n }, () => Array(n).fill(false));
  const roleOf = l => r.role[l];
  for (const p of r.pieces) {
    const roles = p.clusters.map(roleOf);
    if (p.kind === 'plain') {
      for (let y = p.y; y < p.y + p.h; y++)
        for (let x = p.x; x < p.x + p.w; x++) {
          cells[y][x].roles = [roles[0]];
          if (x < p.x + p.w - 1) hj[y][x] = true;
          if (y < p.y + p.h - 1) vj[y][x] = true;
        }
    } else if (p.w === 1 && p.h === 1) {
      cells[p.y][p.x].shape = p.kind === 'q' ? 'X' : p.kind;
      cells[p.y][p.x].roles = roles;
    } else {
      // a cut piece over several cells is shown as plain squares of its first fabric (say so in a note)
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) cells[y][x].roles = [roles[0]];
    }
  }
  r.cells.forEach((m, i) => {
    cells[Math.floor(i / n)][i % n].unsure = m < 0.9;
  });
  // the fabrics as found, by role: the colour of the largest cluster with that role (the rest: greys)
  const palette = Array.from({ length: 6 }, (_, q) => {
    const i = r.role.findIndex((rl, k) => rl === q && r.fabrics[k]);
    return i >= 0 ? r.fabrics[i] : [200 - q * 25, 200 - q * 25, 200 - q * 25];
  });
  const { x0, y0, x1, y1 } = r.box;
  const LX = Array.from({ length: n + 1 }, (_, k) => (x0 + ((x1 - x0) * k) / n) / scale),
    LY = Array.from({ length: n + 1 }, (_, k) => (y0 + ((y1 - y0) * k) / n) / scale);
  return {
    name: b.name,
    n,
    w: bw,
    h: bh,
    image: 'data:image/png;base64,' + encodePng(bw, bh, rgb).toString('base64'),
    LX,
    LY,
    palette,
    cells,
    hj,
    vj,
    rows: r.rows,
    match: r.match,
  };
});

const html = fs
  .readFileSync(new URL('diagram-review.template.html', import.meta.url), 'utf8')
  .replace('__DATA__', () =>
    JSON.stringify({ id: path.basename(sheet.page) + ':' + blocks.map(b => b.name).join(','), blocks }),
  );
fs.writeFileSync(outFile, html);
console.log(`wrote ${outFile}: ${blocks.length} diagrams`);
for (const b of blocks)
  console.log(
    `  ${b.name}: ${b.n} × ${b.n}, ${b.cells.flat().filter(c => c.unsure).length} unsure cells, ${(b.match * 100).toFixed(0)}% redraw match`,
  );
