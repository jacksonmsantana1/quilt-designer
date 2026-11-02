// Reads the line drawings of a page and writes ONE web page where you can see each block's drawing next to what was
// read, and click what is different. Nothing to install: open the page in a browser, fix, press "Copy corrections" and
// paste them in the chat (or "Download" and tell me where the file is).
//
//   node shared/tools/drawing-review.mjs sheet.json [review.html]
//
// sheet.json:  { "page": "C:/path/page.png", "blocks": [ { "name": "1137", "box": [x, y, w, h], "n": 4 }, ... ] }
//   page  a PNG (or webp/jpg: ffmpeg turns it into one)      box  the block's place in the page, in pixels
//   n     cells across and down                              name what you want to call it
// The reading uses the seam rules (src/drawing-reader.js) and, where it is sure, the small network trained on past
// corrections (data/cell-net.json). Cells the two disagree on, or the network is unsure of, are marked "?".
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { decodePng, encodePng } from './png.mjs';
import { notation, readDrawing } from '../src/drawing-reader.js';
import { predict } from '../src/cell-net.js';

const [sheetFile, outFile = 'drawing-review.html'] = process.argv.slice(2);
if (!sheetFile) {
  console.error('Usage: node shared/tools/drawing-review.mjs sheet.json [review.html]');
  process.exit(1);
}
const sheet = JSON.parse(fs.readFileSync(sheetFile, 'utf8'));

// the page as grey pixels
let file = sheet.page;
if (!/\.png$/i.test(file)) {
  const tmp = path.join(os.tmpdir(), 'drawing-review-page.png');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, tmp]);
  if (r.status !== 0) throw new Error('ffmpeg could not read ' + file);
  file = tmp;
}
const img = decodePng(fs.readFileSync(file)),
  ch = img.data.length / (img.width * img.height),
  gray = new Float32Array(img.width * img.height);
for (let i = 0; i < gray.length; i++) {
  const o = i * ch;
  gray[i] = ch >= 3 ? 0.3 * img.data[o] + 0.59 * img.data[o + 1] + 0.11 * img.data[o + 2] : img.data[o];
}
const page = { width: img.width, height: img.height, gray };

// the network, if there is one
let net = null;
try {
  net = JSON.parse(fs.readFileSync(new URL('../data/cell-net.json', import.meta.url), 'utf8'));
} catch (e) {}
const SURE = 0.9;
const classify = net ? s => (predict(net, s).p > SURE ? predict(net, s).shape : null) : null;

const blocks = sheet.blocks.map(b => {
  const [bx, by, bw, bh] = b.box;
  const rules = readDrawing(page, b.box, b.n),
    R = readDrawing(page, b.box, b.n, { classify });
  // the crop, as a picture the page can show
  const rgb = new Uint8Array(bw * bh * 3);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const v = gray[(by + y) * img.width + bx + x];
      rgb.fill(v, (y * bw + x) * 3, (y * bw + x) * 3 + 3);
    }
  return {
    name: b.name,
    n: b.n,
    w: bw,
    h: bh,
    image: 'data:image/png;base64,' + encodePng(bw, bh, rgb).toString('base64'),
    LX: R.LX,
    LY: R.LY,
    rows: notation(R),
    cells: R.cells.map((row, r) =>
      row.map((c, k) => {
        const p = net ? predict(net, c) : null;
        return {
          shape: c.shape,
          roles: c.roles,
          patch: c.patch,
          size: c.size,
          feats: c.feats.map(v => Math.round(v * 1000) / 1000),
          unsure: rules.cells[r][k].shape !== c.shape || (p ? p.p < SURE : false),
        };
      }),
    ),
  };
});

const html = fs
  .readFileSync(new URL('drawing-review.template.html', import.meta.url), 'utf8')
  .replace('__DATA__', () =>
    JSON.stringify({ id: path.basename(sheet.page) + ':' + blocks.map(b => b.name).join(','), blocks }),
  );
fs.writeFileSync(outFile, html);
console.log(
  `wrote ${outFile}: ${blocks.length} blocks, ${blocks.reduce((a, b) => a + b.n * b.n, 0)} cells, ${blocks.reduce((a, b) => a + b.cells.flat().filter(c => c.unsure).length, 0)} marked "?"${net ? '' : ' (no network yet)'}`,
);
