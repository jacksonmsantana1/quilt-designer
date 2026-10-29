// Made-up quilting fabrics for development: seamless 512 px pictures (stripes, gingham, dots, plaids, small
// florals...) drawn in plain code and saved as PNG, so the seed script needs no image library. The same number
// always gives the same fabric, so seeding twice adds nothing new.
import zlib from 'node:zlib';

const SIZE = 512; // every repeat below divides 512, so the picture tiles without a seam

/** Colours quilters would recognise, by name. @type {[string, number][]} */
const COLOURS = [
  ['navy', 0x1f2a44],
  ['cobalt', 0x2451a6],
  ['sky', 0x8fc1e3],
  ['teal', 0x1b7f7a],
  ['aqua', 0x7fd1c7],
  ['sage', 0x9caf88],
  ['olive', 0x6b7a2a],
  ['forest', 0x2e5a3a],
  ['mustard', 0xd9a520],
  ['butter', 0xf3e2a0],
  ['tangerine', 0xe8762c],
  ['coral', 0xef7f6a],
  ['brick', 0xa3402e],
  ['cherry', 0xc3243a],
  ['rose', 0xe9a3b4],
  ['blush', 0xf6d5d0],
  ['plum', 0x6b2f5b],
  ['lavender', 0xb7a6d6],
  ['chocolate', 0x5b3a29],
  ['tan', 0xc9a77c],
  ['charcoal', 0x3a3a3c],
  ['grey', 0x9a9a9c],
  ['cream', 0xf5efe0],
  ['white', 0xfbfbf8],
];
const WHITES = COLOURS.filter(([n]) => n === 'white' || n === 'cream');

/** A small seeded random number generator (mulberry32): the same seed gives the same numbers. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const lum = c => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
const mix = (a, b, t) => {
  const ch = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** An RGB picture with the few drawing tools the patterns need. Shapes wrap around the edges. */
function canvas() {
  const px = new Uint8ClampedArray(SIZE * SIZE * 3);
  const wrap = v => ((v % SIZE) + SIZE) % SIZE;
  const blend = (x, y, c, a = 1) => {
    const i = (wrap(y) * SIZE + wrap(x)) * 3;
    px[i] += (((c >> 16) & 255) - px[i]) * a;
    px[i + 1] += (((c >> 8) & 255) - px[i + 1]) * a;
    px[i + 2] += ((c & 255) - px[i + 2]) * a;
  };
  return {
    px,
    blend,
    /** Paints every pixel with the colour f(x, y) gives. */
    fill(f) {
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) blend(x, y, f(x, y));
    },
    /** A filled circle with soft (anti-aliased) edges. */
    circle(cx, cy, r, c) {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const a = Math.min(1, Math.max(0, r - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
          if (a > 0) blend(x, y, c, a);
        }
    },
    /** A little random grain all over, so it reads as cloth rather than flat colour. */
    grain(rnd, amount) {
      for (let i = 0; i < px.length; i += 3) {
        const d = (rnd() - 0.5) * amount;
        px[i] += d;
        px[i + 1] += d;
        px[i + 2] += d;
      }
    },
  };
}

/** The kinds of fabric, each drawn on a canvas `d` with a background and a main colour. */
const KINDS = {
  Solid(d, rnd, bg, fg) {
    d.fill(() => fg);
    d.grain(rnd, 14);
  },
  Stripe(d, rnd, bg, fg) {
    const p = pick(rnd, [16, 32, 64, 128]),
      w = Math.round(p * (0.2 + rnd() * 0.4)),
      across = rnd() < 0.5;
    d.fill((x, y) => ((across ? y : x) % p < w ? fg : bg));
  },
  Pinstripe(d, rnd, bg, fg) {
    const p = pick(rnd, [8, 16, 32]),
      w = 1 + Math.floor(rnd() * 3),
      across = rnd() < 0.5;
    d.fill((x, y) => ((across ? y : x) % p < w ? fg : bg));
  },
  'Bias stripe'(d, rnd, bg, fg) {
    const p = pick(rnd, [16, 32, 64]),
      w = Math.round(p * (0.3 + rnd() * 0.3)),
      left = rnd() < 0.5;
    d.fill((x, y) => ((left ? x + y : x - y + SIZE) % p < w ? fg : bg));
  },
  Gingham(d, rnd, bg, fg) {
    const p = pick(rnd, [8, 16, 32]);
    d.fill((x, y) => {
      const n = (x % (2 * p) < p ? 1 : 0) + (y % (2 * p) < p ? 1 : 0);
      return n === 2 ? fg : n === 1 ? mix(bg, fg, 0.5) : bg;
    });
  },
  Check(d, rnd, bg, fg) {
    const p = pick(rnd, [16, 32, 64, 128]);
    d.fill((x, y) => ((((x / p) | 0) + ((y / p) | 0)) % 2 ? fg : bg));
  },
  'Polka dot'(d, rnd, bg, fg) {
    const p = pick(rnd, [32, 64, 128]),
      r = p * (0.12 + rnd() * 0.18);
    d.fill(() => bg);
    for (let j = 0; j < SIZE / p; j++)
      for (let i = 0; i < SIZE / p; i++) d.circle(i * p + p / 2 + (j % 2 ? p / 2 : 0), j * p + p / 2, r, fg);
  },
  Ditsy(d, rnd, bg, fg) {
    const other = pick(rnd, COLOURS)[1];
    d.fill(() => bg);
    for (let n = 150 + Math.floor(rnd() * 250); n > 0; n--)
      d.circle(rnd() * SIZE, rnd() * SIZE, 2 + rnd() * 3, rnd() < 0.7 ? fg : other);
  },
  Floral(d, rnd, bg, fg) {
    const middle = pick(rnd, COLOURS)[1],
      leaf = pick(rnd, [0x9caf88, 0x6b7a2a, 0x2e5a3a]);
    d.fill(() => bg);
    for (let n = 25 + Math.floor(rnd() * 45); n > 0; n--) {
      const cx = rnd() * SIZE,
        cy = rnd() * SIZE,
        r = 5 + rnd() * 8,
        turn = rnd() * Math.PI;
      d.circle(cx + Math.cos(turn) * r * 2.2, cy + Math.sin(turn) * r * 2.2, r * 0.55, leaf);
      for (let k = 0; k < 5; k++) {
        const a = turn + (k * 2 * Math.PI) / 5;
        d.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.7, fg);
      }
      d.circle(cx, cy, r * 0.5, middle);
    }
  },
  Plaid(d, rnd, bg, fg) {
    const p = pick(rnd, [128, 256]);
    const bands = [{ at: 0, w: p * (0.15 + rnd() * 0.2), c: fg }];
    for (let n = 2 + Math.floor(rnd() * 3); n > 0; n--)
      bands.push({ at: rnd() * p, w: p * (0.03 + rnd() * 0.12), c: rnd() < 0.5 ? fg : pick(rnd, COLOURS)[1] });
    const inBand = (v, b) => (v - b.at + p) % p < b.w;
    d.fill(() => bg);
    for (const b of bands)
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          if (inBand(x, b)) d.blend(x, y, b.c, 0.45);
          if (inBand(y, b)) d.blend(x, y, b.c, 0.45);
        }
  },
  Chevron(d, rnd, bg, fg) {
    const p = pick(rnd, [32, 64, 128]),
      q = pick(rnd, [16, 32, 64]);
    d.fill((x, y) => ((y + Math.abs((x % p) - p / 2)) % q < q / 2 ? fg : bg));
  },
};
export const KIND_NAMES = Object.keys(KINDS);

/** Writes RGB pixels as a PNG file (no filtering: the patterns are simple and still pack small). */
export function encodePng(width, height, rgb) {
  const row = width * 3;
  const raw = Buffer.alloc((row + 1) * height); // each row starts with its filter byte, 0 = none
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8 bits per channel, RGB, standard compression/filters, not interlaced
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Fabric number n: kinds take turns so any count gets an even mix.
 * @param {number} n @returns {{ name: string, cm: number, png: Buffer }}
 */
export function makeFabric(n) {
  const kind = KIND_NAMES[n % KIND_NAMES.length];
  const rnd = random(n + 1);
  const [fgName, fg] = pick(rnd, COLOURS);
  // the background is a lighter colour than the main one (white/cream for gingham); a very light main colour
  // goes on a darker background instead
  const lighter = COLOURS.filter(([, c]) => lum(c) > lum(fg) + 60);
  const darker = COLOURS.filter(([, c]) => lum(c) < lum(fg) - 60);
  const [bgName, bg] =
    kind === 'Gingham' && lum(fg) < 200 ? pick(rnd, WHITES) : pick(rnd, lighter.length ? lighter : darker);
  const d = canvas();
  KINDS[kind](d, rnd, bg, fg);
  if (kind !== 'Solid') d.grain(rnd, 6);
  const name = kind === 'Solid' ? `Solid ${fgName} #${n}` : `${kind}, ${fgName} on ${bgName} #${n}`;
  const cm = Math.round((10 + rnd() * 25) * 2) / 2; // real width of the picture: 10 to 35 cm
  return { name, cm, png: encodePng(SIZE, SIZE, d.px) };
}
