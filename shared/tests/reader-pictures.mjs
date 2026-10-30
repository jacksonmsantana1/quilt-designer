// Test pictures for the block reader: the app's own blocks drawn as images (so the right answer is known), and how
// much of a block the reader's answer gets right.
import { partsOf } from '@quilt/shared/patterns.js';
import { pointInPoly } from '@quilt/shared/geometry.js';
import { S, clusterAt, readBlock } from '@quilt/shared/block-reader.js';
import { ROLE_COLOURS } from '@quilt/shared/design.js';

// each role in its default fabric's colour
const ROLE_RGB = ROLE_COLOURS.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const W = 200;

/** The true colour role at each pixel of a W × W picture of a block. */
function roleMap(key) {
  const parts = partsOf(key),
    out = new Uint8Array(W * W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W,
        v = (y + 0.5) / W;
      out[y * W + x] = (parts.find(p => pointInPoly(u, v, p.poly)) || { role: 0 }).role;
    }
  return out;
}

/**
 * A picture of a block: the default colours, and on request grain (noise), dark seam lines and a slight blur.
 * The same block and options always give the same picture.
 */
export function picture(key, { noise = 0, seams = false, blur = false } = {}) {
  const roles = roleMap(key),
    parts = partsOf(key);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  let data = new Float32Array(W * W * 3);
  for (let i = 0; i < W * W; i++)
    for (let k = 0; k < 3; k++) data[i * 3 + k] = ROLE_RGB[roles[i]][k] + rnd() * 2 * noise;
  if (seams) {
    // a pixel is on a seam when a neighbour is in another piece
    const which = new Int16Array(W * W);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++)
        which[y * W + x] = parts.findIndex(p => pointInPoly((x + 0.5) / W, (y + 0.5) / W, p.poly));
    for (let y = 1; y < W - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (which[i] !== which[i + 1] || which[i] !== which[i + W]) for (let k = 0; k < 3; k++) data[i * 3 + k] *= 0.45;
      }
  }
  if (blur) {
    const b = new Float32Array(data.length);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++)
        for (let k = 0; k < 3; k++) {
          let s = 0,
            c = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
              s += data[(yy * W + xx) * 3 + k];
              c++;
            }
          b[(y * W + x) * 3 + k] = s / c;
        }
    data = b;
  }
  return { width: W, height: W, data: Uint8Array.from(data, v => Math.max(0, Math.min(255, Math.round(v)))) };
}

/**
 * Reads a picture of a block and compares the answer, drawn back, with the block's true pieces: each fabric the
 * reader found stands for the true colour role most of its pixels have. Seams are not counted.
 * @returns {{ n: number, right: number, read: ReturnType<typeof readBlock> }}
 */
export function scoreRead(key, img) {
  const r = readBlock(img),
    truth = roleMap(key);
  const size = S / r.n,
    at = (x, y) => {
      // the answer's fabric at picture pixel (x, y)
      const sx = Math.min(S - 1, Math.floor(((x + 0.5) / W) * S)),
        sy = Math.min(S - 1, Math.floor(((y + 0.5) / W) * S));
      const p = r.pieceAt[Math.min(r.n - 1, Math.floor(sy / size)) * r.n + Math.min(r.n - 1, Math.floor(sx / size))];
      return clusterAt(p, sx, sy, size);
    };
  const votes = r.fabrics.map(() => ROLE_COLOURS.map(() => 0));
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) votes[at(x, y)][truth[y * W + x]]++;
  const roleOf = votes.map(v => v.indexOf(Math.max(...v)));
  let ok = 0;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (roleOf[at(x, y)] === truth[y * W + x]) ok++;
  return { n: r.n, right: ok / (W * W), read: r };
}
